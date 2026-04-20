/**
 * Twilio Webhook Routes
 *
 * POST /twiml/outbound  — Twilio çağrı cevaplandığında bu URL'i çağırır
 *                          → TwiML döner ve WebSocket stream'i başlatır
 * POST /twiml/status    — Çağrı durum güncellemeleri
 * WS   /stream          — Twilio Media Stream WebSocket endpoint'i
 */

import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { config } from '../config';
import { handleTwilioMediaStream } from '../services/bridge';
import { updateCallStatus } from '../services/supabase';

export const twilioRouter = Router();

// ─── TwiML: Outbound çağrı cevaplandığında ────────────────────────────────────
twilioRouter.post('/twiml/outbound', (req: Request, res: Response) => {
  const { agentDbId, organizationId, callDbId } = req.query as Record<string, string>;

  if (!agentDbId || !organizationId) {
    res.status(400).send('Missing required parameters');
    return;
  }

  const streamUrl = `${config.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/stream`;

  // TwiML: Ses akışını WebSocket bridge'e yönlendir
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="agentDbId" value="${agentDbId}" />
      <Parameter name="organizationId" value="${organizationId}" />
      <Parameter name="callDbId" value="${callDbId ?? ''}" />
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
  console.log(`[TwiML] Outbound TwiML gönderildi | agentDbId: ${agentDbId}`);
});

// ─── TwiML: Inbound çağrı geldiğinde ─────────────────────────────────────────
twilioRouter.post('/twiml/inbound', (req: Request, res: Response) => {
  // Telefon numarasına göre hangi agent'ın cevap vereceğini belirleyebilirsiniz
  // Şimdilik env'deki default agent'ı kullan
  const { agentDbId, organizationId } = req.query as Record<string, string>;

  const streamUrl = `${config.serverUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/stream`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="agentDbId" value="${agentDbId ?? ''}" />
      <Parameter name="organizationId" value="${organizationId ?? ''}" />
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
  console.log(`[TwiML] Inbound çağrı cevaplandı | from: ${req.body?.From}`);
});

// ─── Twilio Status Callback ───────────────────────────────────────────────────
twilioRouter.post('/twiml/status', async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = req.body as {
    CallSid: string;
    CallStatus: string;
    CallDuration?: string;
  };

  console.log(`[Status] CallSid: ${CallSid} | Status: ${CallStatus} | Duration: ${CallDuration}s`);

  // Twilio status → bizim status mapping
  const statusMap: Record<string, string> = {
    'completed':   'completed',
    'failed':      'failed',
    'busy':        'busy',
    'no-answer':   'no_answer',
    'cancelled':   'cancelled',
    'ringing':     'ringing',
    'in-progress': 'in_progress',
  };

  const ourStatus = statusMap[CallStatus] ?? CallStatus;

  // callDbId'yi bulmak için callSid'i kullanabiliriz (bridge session veya DB'den)
  // Bu endpoint genellikle session bitmeden sonra çağrılır
  // Supabase'de twilio_call_sid ile sorgulayıp güncelliyoruz
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    const { data: callRecord } = await supabase
      .from('calls')
      .select('id')
      .eq('twilio_call_sid', CallSid)
      .single();

    if (callRecord) {
      await updateCallStatus(callRecord.id, ourStatus, {
        duration_seconds: CallDuration ? parseInt(CallDuration, 10) : undefined,
      });
    }
  } catch (err) {
    console.error('[Status] DB güncellemesi başarısız:', err);
  }

  res.sendStatus(200);
});

// ─── WebSocket Server kurulumu (ana server'da çağrılır) ───────────────────────
export function setupTwilioWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? '';
    console.log(`[WSS] Yeni WebSocket bağlantısı | path: ${url}`);

    if (!url.startsWith('/stream')) {
      ws.close(1008, 'Invalid path');
      return;
    }

    // Default agent ve org bilgileri (customParameters üzerinden override edilecek)
    // Bridge içinde start event'inde customParameters'dan alınır
    handleTwilioMediaStream(ws, '', '', undefined).catch((err) => {
      console.error('[WSS] Bridge hatası:', err);
      ws.close(1011, 'Internal error');
    });
  });

  console.log('[WSS] Twilio WebSocket Server hazır');
}
