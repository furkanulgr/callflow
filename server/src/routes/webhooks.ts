/**
 * ElevenLabs Post-Call Webhook Handler
 *
 * ElevenLabs her arama bittiğinde bu endpoint'i çağırır.
 * Kampanya istatistiklerini (called, answered) Supabase'de günceller.
 *
 * POST /api/webhooks/elevenlabs
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { config } from '../config';

export const webhooksRouter = Router();

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// ─── ElevenLabs Webhook Payload ───────────────────────────────────────────────
interface ElevenLabsWebhookPayload {
  type: string; // 'post_call_webhook' | 'conversation.ended' | ...
  event_timestamp?: number;
  data: {
    conversation_id:      string;
    agent_id:             string;
    status:               string;   // 'completed' | 'failed' | ...
    call_duration_secs?:  number;
    start_time_unix_secs?: number;
    transcript?: Array<{
      role:              'agent' | 'user';
      message:           string;
      time_in_call_secs: number;
    }>;
    analysis?: {
      evaluation_criteria_results?: Record<string, any>;
      data_collection_results?:     Record<string, any>;
      call_successful?:             string; // 'success' | 'failure' | 'unknown'
    };
    metadata?: Record<string, any>;
    call?: {
      phone_number_id?: string;
      to?:              string;
      direction?:       string;
    };
  };
}

// ─── HMAC signature doğrulama ─────────────────────────────────────────────────
function verifyElevenLabsSignature(req: Request): boolean {
  const rawSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!rawSecret) {
    console.log('[Webhook] ⚠️ ELEVENLABS_WEBHOOK_SECRET tanımlı değil — geçildi');
    return true;
  }

  const signature = req.headers['elevenlabs-signature'] as string;
  if (!signature) {
    console.warn('[Webhook] ❌ elevenlabs-signature header eksik');
    return false;
  }

  // ElevenLabs imza formatı: t=timestamp,v0=hash
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')));
  const timestamp = parts['t'];
  const hash = parts['v0'];
  if (!timestamp || !hash) {
    console.warn('[Webhook] ❌ signature formatı geçersiz | parts:', parts);
    return false;
  }

  const rawBody = (req as any).rawBody as string | undefined;
  if (!rawBody) {
    console.warn('[Webhook] ❌ rawBody yok');
    return false;
  }

  // Secret'ı 4 farklı şekilde dene: trim, prefix var/yok kombinasyonları
  const secrets = [
    rawSecret,
    rawSecret.trim(),
    rawSecret.replace(/^wsec_/, ''),
    rawSecret.trim().replace(/^wsec_/, ''),
  ];

  const payload = `${timestamp}.${rawBody}`;

  for (const s of secrets) {
    const expected = createHmac('sha256', s).update(payload).digest('hex');
    if (expected === hash) {
      console.log('[Webhook] ✅ HMAC doğrulandı');
      return true;
    }
  }

  console.warn('[Webhook] ❌ HMAC eşleşmedi (4 secret varyantı denendi)');
  console.warn(`[Webhook]    received: ${hash.substring(0, 16)}...`);
  console.warn(`[Webhook]    secret length: ${rawSecret.length} (trimmed: ${rawSecret.trim().length})`);
  return false;
}

// ─── POST /api/webhooks/elevenlabs ───────────────────────────────────────────
webhooksRouter.post('/elevenlabs', async (req: Request, res: Response): Promise<void> => {
  // Signature doğrula
  if (!verifyElevenLabsSignature(req)) {
    res.sendStatus(401);
    return;
  }

  // ElevenLabs 200 almazsa retry atar — hemen 200 döndür
  res.sendStatus(200);

  const payload = req.body as ElevenLabsWebhookPayload;
  const eventType = payload.type || 'unknown';

  console.log(`[Webhook] ElevenLabs | type: ${eventType} | conv: ${payload.data?.conversation_id}`);

  // Sadece konuşma biten eventleri işle
  const isCallEnd = [
    'post_call_webhook',
    'conversation.ended',
    'conversation.completed',
  ].includes(eventType);

  if (!isCallEnd || !payload.data) return;

  const {
    conversation_id,
    agent_id,
    status,
    call_duration_secs = 0,
    analysis,
    metadata,
    call,
  } = payload.data;

  const wasAnswered = call_duration_secs > 0 && status !== 'failed';

  try {
    // 1. Agent'a bağlı aktif/son kampanyayı bul
    //    batch_id metadata'da gelebilir — varsa önce ona bak
    const batchId: string | undefined =
      metadata?.batch_id ||
      metadata?.batch_call_id ||
      call?.phone_number_id; // fallback

    let campaign: { id: string } | null = null;

    if (batchId) {
      const { data } = await supabase
        .from('campaigns')
        .select('id')
        .eq('batch_id', batchId)
        .single();
      campaign = data;
    }

    if (!campaign && agent_id) {
      // batch_id yoksa → agent_id ile en son aktif kampanyayı al
      const { data } = await supabase
        .from('campaigns')
        .select('id')
        .eq('agent_id', agent_id)
        .in('status', ['active', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      campaign = data;
    }

    if (!campaign) {
      console.warn(`[Webhook] Kampanya bulunamadı | agent: ${agent_id} | batch: ${batchId}`);
      return;
    }

    // 2. Kampanya sayaçlarını artır (atomic RPC — race condition yok)
    const { error: rpcError } = await supabase.rpc('increment_campaign_stats', {
      p_campaign_id: campaign.id,
      p_called:      1,
      p_answered:    wasAnswered ? 1 : 0,
    });

    if (rpcError) {
      // RPC yoksa direkt update ile fallback
      const { data: current } = await supabase
        .from('campaigns')
        .select('called, answered')
        .eq('id', campaign.id)
        .single();

      if (current) {
        await supabase
          .from('campaigns')
          .update({
            called:   (current.called   || 0) + 1,
            answered: (current.answered || 0) + (wasAnswered ? 1 : 0),
          })
          .eq('id', campaign.id);
      }
    }

    // 3. Konuşmayı conversations tablosuna kaydet (opsiyonel)
    const phoneNumber = call?.to || metadata?.to || null;
    await supabase.from('campaign_calls').upsert({
      campaign_id:     campaign.id,
      conversation_id,
      agent_id,
      phone_number:    phoneNumber,
      status:          wasAnswered ? 'answered' : 'missed',
      duration_secs:   Math.round(call_duration_secs),
      call_successful: analysis?.call_successful || 'unknown',
      raw_analysis:    analysis || null,
      occurred_at:     new Date().toISOString(),
    }, { onConflict: 'conversation_id' });

    console.log(
      `[Webhook] ✅ Kampanya güncellendi | id: ${campaign.id} | yanıtladı: ${wasAnswered} | süre: ${call_duration_secs}s`
    );

  } catch (err) {
    console.error('[Webhook] Hata:', err);
  }
});

// ─── GET /api/webhooks/health ─────────────────────────────────────────────────
webhooksRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
