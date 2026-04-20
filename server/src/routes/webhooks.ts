/**
 * ElevenLabs Post-Call Webhook Handler
 *
 * ElevenLabs çağrı bittiğinde bu endpoint'i çağırır.
 * Transcript, süre, conversation ID → Supabase'e kaydeder.
 * Ardından n8n / CRM webhook'unu tetikler.
 *
 * POST /webhooks/elevenlabs
 */

import { Router, Request, Response } from 'express';
import { config } from '../config';
import { finalizeCall, logWebhook } from '../services/supabase';
import { elevenlabsApi } from '../services/elevenlabs';
import { createClient } from '@supabase/supabase-js';

export const webhooksRouter = Router();

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface ElevenLabsWebhookPayload {
  type:            string;  // 'conversation.ended' | 'conversation.initiated' vb.
  event_timestamp: number;
  data: {
    conversation_id:      string;
    agent_id:             string;
    status:               string;
    call_duration_secs:   number;
    start_time_unix_secs: number;
    transcript?:          Array<{
      role:                 'agent' | 'user';
      message:              string;
      time_in_call_secs:    number;
    }>;
    metadata?: Record<string, unknown>;
  };
}

// ─── POST /webhooks/elevenlabs ────────────────────────────────────────────────
webhooksRouter.post('/elevenlabs', async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as ElevenLabsWebhookPayload;

  console.log(`[Webhook] ElevenLabs event: ${payload.type} | convId: ${payload.data?.conversation_id}`);

  // Sadece conversation.ended event'ini işle
  if (payload.type !== 'conversation.ended') {
    res.sendStatus(200);
    return;
  }

  const { conversation_id, agent_id, call_duration_secs, transcript } = payload.data;

  try {
    // DB'de bu conversation_id'ye sahip çağrıyı bul
    const { data: callRecord } = await supabase
      .from('calls')
      .select('id, organization_id, campaign_id')
      .eq('elevenlabs_conv_id', conversation_id)
      .single();

    if (!callRecord) {
      // Conversation ID henüz DB'ye yazılmamış olabilir (race condition)
      // ElevenLabs'dan tam conversation detayını çekip tekrar dene
      console.warn(`[Webhook] DB'de conversation bulunamadı: ${conversation_id}`);
      res.sendStatus(200);
      return;
    }

    // Transcript'i bizim formata çevir
    const formattedTranscript = (transcript ?? []).map((t) => ({
      role:      t.role,
      text:      t.message,
      timestamp: new Date(
        (payload.data.start_time_unix_secs + t.time_in_call_secs) * 1000
      ).toISOString(),
    }));

    // Çağrıyı DB'de tamamla
    await finalizeCall(callRecord.id, {
      status:           'completed',
      durationSeconds:  Math.round(call_duration_secs),
      transcript:       formattedTranscript,
      elevenlabsConvId: conversation_id,
    });

    console.log(`[Webhook] Çağrı tamamlandı | callId: ${callRecord.id} | süre: ${call_duration_secs}s | transcript: ${formattedTranscript.length} mesaj`);

    // n8n / CRM webhook tetikle
    if (config.n8n.webhookUrl) {
      await triggerN8nWebhook({
        callId:         callRecord.id,
        organizationId: callRecord.organization_id,
        campaignId:     callRecord.campaign_id,
        conversationId: conversation_id,
        agentId:        agent_id,
        durationSeconds: Math.round(call_duration_secs),
        transcript:     formattedTranscript,
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Webhook] İşleme hatası:', err);
    res.sendStatus(500);
  }
});

// ─── n8n Webhook tetikleyici ──────────────────────────────────────────────────
async function triggerN8nWebhook(data: {
  callId:          string;
  organizationId:  string;
  campaignId?:     string;
  conversationId:  string;
  agentId:         string;
  durationSeconds: number;
  transcript:      Array<{ role: string; text: string; timestamp: string }>;
}): Promise<void> {
  if (!config.n8n.webhookUrl) return;

  const payload = {
    event:     'call.completed',
    timestamp: new Date().toISOString(),
    ...data,
  };

  let responseStatus: number | undefined;
  let responseBody:   string | undefined;
  let success = false;

  try {
    const response = await fetch(config.n8n.webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;
    responseBody   = await response.text();
    success        = response.ok;
    console.log(`[Webhook] n8n'e gönderildi | status: ${responseStatus}`);
  } catch (err) {
    console.error('[Webhook] n8n hatası:', err);
  }

  await logWebhook({
    organizationId: data.organizationId,
    callId:         data.callId,
    campaignId:     data.campaignId,
    url:            config.n8n.webhookUrl,
    requestBody:    payload,
    responseStatus,
    responseBody,
    success,
  }).catch(console.error);
}
