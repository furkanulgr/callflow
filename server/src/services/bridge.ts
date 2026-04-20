/**
 * CallFlow - Twilio ↔ ElevenLabs ConvAI WebSocket Bridge
 *
 * Ses akış mimarisi:
 *   [Telefon] ←mulaw 8kHz→ [Twilio] ←WS→ [Bridge] ←WS→ [ElevenLabs ConvAI]
 *
 * Kritik notlar:
 * - Twilio: mulaw (G.711 u-law) 8kHz, base64 encoded
 * - ElevenLabs: ulaw_8000 input/output formatını destekler → format dönüşümü gerekmez
 * - Gecikme minimizasyonu için buffer boyutu minimize edildi
 */

import WebSocket from 'ws';
import { config } from '../config';
import {
  finalizeCall,
  logWebhook,
  updateCallAnswered,
  updateCallStatus,
  getAgentById,
} from './supabase';
import type {
  BridgeSession,
  ElevenLabsIncomingMessage,
  TwilioMediaStreamMessage,
  TwilioSendMediaMessage,
  TwilioClearMessage,
  TranscriptEntry,
} from '../types';

// Aktif session'ları tutan in-memory map (callSid → session)
const activeSessions = new Map<string, BridgeSession>();

export function getSession(callSid: string): BridgeSession | undefined {
  return activeSessions.get(callSid);
}

export function getAllSessions(): BridgeSession[] {
  return Array.from(activeSessions.values());
}

/**
 * Twilio Media Stream WebSocket bağlantısı geldiğinde çağrılır.
 * Her telefon çağrısı için bir bridge session başlatır.
 */
export async function handleTwilioMediaStream(
  twilioWs: WebSocket,
  agentDbId: string,
  organizationId: string,
  callDbId?: string,
): Promise<void> {
  let session: BridgeSession | null = null;
  let elevenlabsWs: WebSocket | null = null;
  let callStartTime: Date | null = null;

  console.log('[Bridge] Yeni Twilio bağlantısı bekleniyor...');

  twilioWs.on('message', async (rawMessage: Buffer) => {
    let msg: TwilioMediaStreamMessage;

    try {
      msg = JSON.parse(rawMessage.toString()) as TwilioMediaStreamMessage;
    } catch {
      console.error('[Bridge] Twilio mesajı parse hatası');
      return;
    }

    switch (msg.event) {
      // ── 1. Bağlantı kuruldu ──────────────────────────────────────────────
      case 'connected': {
        console.log('[Bridge] Twilio connected event alındı');
        break;
      }

      // ── 2. Stream başladı (çağrı cevaplandı) ────────────────────────────
      case 'start': {
        if (!msg.start) break;

        const { callSid, streamSid, customParameters } = msg.start;
        callStartTime = new Date();

        // customParameters üzerinden meta data taşıyabiliriz
        const finalAgentDbId = customParameters?.['agentDbId'] ?? agentDbId;
        const finalOrgId = customParameters?.['organizationId'] ?? organizationId;
        const finalCallDbId = customParameters?.['callDbId'] ?? callDbId;

        console.log(`[Bridge] Stream başladı | callSid: ${callSid} | streamSid: ${streamSid}`);

        // Session oluştur
        session = {
          callSid,
          streamSid,
          agentId: finalAgentDbId,
          organizationId: finalOrgId,
          callDbId: finalCallDbId,
          transcript: [],
          startedAt: callStartTime,
        };
        activeSessions.set(callSid, session);

        // DB'yi güncelle
        if (finalCallDbId) {
          await updateCallAnswered(finalCallDbId).catch(console.error);
        }

        // ElevenLabs bağlantısını aç
        elevenlabsWs = await connectToElevenLabs(
          twilioWs,
          session,
          finalAgentDbId,
        );

        break;
      }

      // ── 3. Ses verisi geldi (kullanıcı konuşuyor) ────────────────────────
      case 'media': {
        if (!msg.media || !elevenlabsWs || elevenlabsWs.readyState !== WebSocket.OPEN) break;

        // Sadece gelen (inbound) sesi ElevenLabs'a ilet
        if (msg.media.track !== 'inbound') break;

        const audioPayload = msg.media.payload; // base64 mulaw

        // ElevenLabs'a gönder
        elevenlabsWs.send(
          JSON.stringify({ user_audio_chunk: audioPayload })
        );
        break;
      }

      // ── 4. Stream bitti (çağrı kapandı) ─────────────────────────────────
      case 'stop': {
        console.log(`[Bridge] Stream durduruldu | callSid: ${msg.stop?.callSid}`);

        if (elevenlabsWs && elevenlabsWs.readyState === WebSocket.OPEN) {
          elevenlabsWs.close(1000, 'Call ended');
        }

        if (session) {
          await endSession(session, callStartTime, 'completed');
        }
        break;
      }
    }
  });

  twilioWs.on('close', async () => {
    console.log('[Bridge] Twilio WebSocket kapandı');
    if (elevenlabsWs && elevenlabsWs.readyState === WebSocket.OPEN) {
      elevenlabsWs.close(1000, 'Twilio closed');
    }
    if (session) {
      await endSession(session, callStartTime, 'completed');
    }
  });

  twilioWs.on('error', (err) => {
    console.error('[Bridge] Twilio WS hatası:', err.message);
  });
}

// ─── ElevenLabs Bağlantısı ────────────────────────────────────────────────────
async function connectToElevenLabs(
  twilioWs: WebSocket,
  session: BridgeSession,
  agentDbId: string,
): Promise<WebSocket> {
  // Agent bilgilerini DB'den çek
  let elevenlabsAgentId: string;
  let elevenlabsApiKey: string;
  let systemPrompt: string | undefined;
  let firstMessage: string | undefined;
  let language = 'tr';

  try {
    const agent = await getAgentById(agentDbId);
    elevenlabsAgentId = agent.elevenlabs_agent_id;
    elevenlabsApiKey = agent.elevenlabs_api_key ?? config.elevenlabs.apiKey;
    systemPrompt = agent.system_prompt ?? undefined;
    firstMessage = agent.first_message ?? undefined;
    language = agent.language ?? 'tr';
  } catch (err) {
    console.error('[Bridge] Agent bilgileri alınamadı, default kullanılıyor:', err);
    elevenlabsAgentId = agentDbId; // fallback: agentDbId as EL agent id
    elevenlabsApiKey = config.elevenlabs.apiKey;
  }

  const wsUrl = `${config.elevenlabs.wsUrl}?agent_id=${elevenlabsAgentId}`;

  console.log(`[Bridge] ElevenLabs bağlantısı açılıyor | agentId: ${elevenlabsAgentId}`);

  const elWs = new WebSocket(wsUrl, {
    headers: { 'xi-api-key': elevenlabsApiKey },
  });

  elWs.on('open', () => {
    console.log('[Bridge] ElevenLabs bağlantısı açıldı');

    // İlk konfigurasyon mesajını gönder
    const initMsg = {
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          ...(systemPrompt && { prompt: { prompt: systemPrompt } }),
          ...(firstMessage && { first_message: firstMessage }),
          language,
        },
      },
    };
    elWs.send(JSON.stringify(initMsg));
  });

  elWs.on('message', async (rawMessage: Buffer) => {
    let msg: ElevenLabsIncomingMessage;

    try {
      msg = JSON.parse(rawMessage.toString()) as ElevenLabsIncomingMessage;
    } catch {
      // Binary audio chunk — ElevenLabs bazen doğrudan binary gönderebilir
      // Bu durumda base64'e çevirip Twilio'ya gönder
      if (rawMessage instanceof Buffer && session) {
        sendAudioToTwilio(twilioWs, session.streamSid, rawMessage.toString('base64'));
      }
      return;
    }

    switch (msg.type) {
      // ── Conversation ID geldi ────────────────────────────────────────
      case 'conversation_initiation_metadata': {
        const convId = msg.conversation_initiation_metadata_event.conversation_id;
        session.elevenlabsConvId = convId;
        console.log(`[Bridge] EL Conversation ID: ${convId}`);

        if (session.callDbId) {
          await updateCallStatus(session.callDbId, 'in_progress', {
            elevenlabs_conv_id: convId,
          }).catch(console.error);
        }
        break;
      }

      // ── Ses verisi (agent konuşuyor) ─────────────────────────────────
      case 'audio': {
        if (twilioWs.readyState !== WebSocket.OPEN) break;
        const audioBase64 = msg.audio_event.audio_base_64;
        sendAudioToTwilio(twilioWs, session.streamSid, audioBase64);
        break;
      }

      // ── Agent metin yanıtı (transcript için) ─────────────────────────
      case 'agent_response': {
        const agentText = msg.agent_response_event.agent_response;
        if (agentText.trim()) {
          session.transcript.push({
            role: 'agent',
            text: agentText,
            timestamp: new Date().toISOString(),
          });
          console.log(`[Transcript] 🤖 Agent: ${agentText}`);
        }
        break;
      }

      // ── Kullanıcı transcript'i ────────────────────────────────────────
      case 'user_transcript': {
        const userText = msg.user_transcription_event.user_transcript;
        if (userText.trim()) {
          session.transcript.push({
            role: 'user',
            text: userText,
            timestamp: new Date().toISOString(),
          });
          console.log(`[Transcript] 👤 User: ${userText}`);
        }
        break;
      }

      // ── Interruption (kullanıcı agent'ı kesti) ───────────────────────
      case 'interruption': {
        console.log('[Bridge] Interruption — Twilio buffer temizleniyor');
        if (twilioWs.readyState === WebSocket.OPEN) {
          const clearMsg: TwilioClearMessage = {
            event: 'clear',
            streamSid: session.streamSid,
          };
          twilioWs.send(JSON.stringify(clearMsg));
        }
        break;
      }

      // ── Ping → Pong ──────────────────────────────────────────────────
      case 'ping': {
        if (elWs.readyState === WebSocket.OPEN) {
          elWs.send(JSON.stringify({
            type: 'pong',
            event_id: msg.ping_event.event_id,
          }));
        }
        break;
      }
    }
  });

  elWs.on('close', (code, reason) => {
    console.log(`[Bridge] ElevenLabs WS kapandı | code: ${code} | reason: ${reason.toString()}`);
  });

  elWs.on('error', (err) => {
    console.error('[Bridge] ElevenLabs WS hatası:', err.message);
  });

  return elWs;
}

// ─── Twilio'ya ses gönder ─────────────────────────────────────────────────────
function sendAudioToTwilio(
  twilioWs: WebSocket,
  streamSid: string,
  audioBase64: string,
): void {
  if (twilioWs.readyState !== WebSocket.OPEN) return;

  const msg: TwilioSendMediaMessage = {
    event: 'media',
    streamSid,
    media: { payload: audioBase64 },
  };
  twilioWs.send(JSON.stringify(msg));
}

// ─── Session bitiş işlemleri ──────────────────────────────────────────────────
async function endSession(
  session: BridgeSession,
  callStartTime: Date | null,
  status: string,
): Promise<void> {
  // Aynı session için çift çalışmayı önle
  if (!activeSessions.has(session.callSid)) return;
  activeSessions.delete(session.callSid);

  const durationSeconds = callStartTime
    ? Math.floor((Date.now() - callStartTime.getTime()) / 1000)
    : undefined;

  console.log(`[Bridge] Session bitti | callSid: ${session.callSid} | süre: ${durationSeconds}s | transcript: ${session.transcript.length} mesaj`);

  // DB'yi güncelle
  if (session.callDbId) {
    await finalizeCall(session.callDbId, {
      status,
      durationSeconds,
      transcript: session.transcript,
      elevenlabsConvId: session.elevenlabsConvId,
    }).catch(console.error);
  }

  // Post-call webhook (n8n, CRM vb.)
  await triggerPostCallWebhook(session, durationSeconds).catch(console.error);
}

// ─── Post-call webhook ────────────────────────────────────────────────────────
async function triggerPostCallWebhook(
  session: BridgeSession,
  durationSeconds?: number,
): Promise<void> {
  if (!config.n8n.webhookUrl) return;

  const payload = {
    event:          'call.completed',
    callSid:        session.callSid,
    callDbId:       session.callDbId,
    organizationId: session.organizationId,
    elevenlabsConvId: session.elevenlabsConvId,
    durationSeconds,
    transcript:     session.transcript,
    timestamp:      new Date().toISOString(),
  };

  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let success = false;

  try {
    const response = await fetch(config.n8n.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });
    responseStatus = response.status;
    responseBody = await response.text();
    success = response.ok;
    console.log(`[Webhook] n8n'e gönderildi | status: ${responseStatus}`);
  } catch (err) {
    console.error('[Webhook] n8n hatası:', err);
  }

  if (session.callDbId) {
    await logWebhook({
      organizationId: session.organizationId,
      callId:         session.callDbId,
      url:            config.n8n.webhookUrl,
      requestBody:    payload,
      responseStatus,
      responseBody,
      success,
    }).catch(console.error);
  }
}
