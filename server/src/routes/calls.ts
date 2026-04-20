/**
 * Calls API Routes — ElevenLabs Native Twilio Integration
 *
 * ElevenLabs kendi bünyesinde Twilio'yu yönetiyor.
 * Biz sadece ElevenLabs API'sine istek atıyoruz.
 *
 * POST /api/calls/outbound        — Tekil outbound çağrı başlat
 * POST /api/calls/batch           — Toplu (kampanya) çağrı başlat
 * GET  /api/calls/active          — Aktif çağrıları listele (Supabase'den)
 * POST /api/calls/:id/hangup      — Çağrıyı kapat
 * GET  /api/calls/phone-numbers   — ElevenLabs'a bağlı telefon numaraları
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createCallRecord, updateCallStatus } from '../services/supabase';
import { elevenlabsApi } from '../services/elevenlabs';
import type { OutboundCallRequest } from '../types';

export const callsRouter = Router();

// ─── POST /api/calls/outbound ─────────────────────────────────────────────────
callsRouter.post('/outbound', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as OutboundCallRequest;
  const { toNumber, agentId, organizationId, phoneNumberId, campaignId, contactId, customVariables } = body;

  if (!toNumber || !agentId || !organizationId || !phoneNumberId) {
    res.status(400).json({
      error: 'toNumber, agentId, organizationId ve phoneNumberId zorunludur',
    });
    return;
  }

  if (!/^\+\d{10,15}$/.test(toNumber)) {
    res.status(400).json({
      error: 'Geçersiz telefon numarası formatı. E.164 kullanın: +905551234567',
    });
    return;
  }

  try {
    // Önce DB'ye kayıt aç (ElevenLabs conversation ID gelince güncellenecek)
    const callDbId = await createCallRecord({
      organizationId,
      agentId,
      fromNumber:    phoneNumberId, // EL phone number id
      toNumber,
      twilioCallSid: `el_pending_${uuidv4()}`,
      campaignId,
      contactId,
      direction:     'outbound',
    });

    // ElevenLabs API üzerinden çağrıyı başlat
    const elResponse = await elevenlabsApi.makeOutboundCall({
      agentId,
      agentPhoneNumberId: phoneNumberId,
      toNumber,
      customVariables,
    });

    // DB kaydını ElevenLabs conversation ID ile güncelle
    await updateCallStatus(callDbId, 'initiated', {
      elevenlabs_conv_id: elResponse.conversationId,
    });

    console.log(`[Calls] Çağrı başlatıldı | to: ${toNumber} | convId: ${elResponse.conversationId}`);

    res.status(201).json({
      success:        true,
      callDbId,
      conversationId: elResponse.conversationId,
      to:             toNumber,
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Calls] Çağrı başlatılamadı:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/calls/batch ────────────────────────────────────────────────────
// ElevenLabs Batch Calling — kampanya için aynı anda çoklu çağrı
callsRouter.post('/batch', async (req: Request, res: Response): Promise<void> => {
  const {
    agentId,
    phoneNumberId,
    organizationId,
    campaignId,
    recipients, // [{ toNumber, customVariables }]
    scheduledAt, // opsiyonel: ISO string
  } = req.body as {
    agentId:       string;
    phoneNumberId: string;
    organizationId: string;
    campaignId?:   string;
    recipients:    Array<{ toNumber: string; customVariables?: Record<string, string> }>;
    scheduledAt?:  string;
  };

  if (!agentId || !phoneNumberId || !organizationId || !recipients?.length) {
    res.status(400).json({ error: 'agentId, phoneNumberId, organizationId ve recipients zorunludur' });
    return;
  }

  try {
    const batchResponse = await elevenlabsApi.makeBatchCall({
      agentId,
      agentPhoneNumberId: phoneNumberId,
      recipients,
      scheduledAt,
    });

    // Her alıcı için DB kaydı oluştur
    const callDbIds = await Promise.all(
      recipients.map(async (r) => {
        const callDbId = await createCallRecord({
          organizationId,
          agentId,
          fromNumber:    phoneNumberId,
          toNumber:      r.toNumber,
          twilioCallSid: `el_batch_${uuidv4()}`,
          campaignId,
          direction:     'outbound',
        });
        return callDbId;
      })
    );

    console.log(`[Calls] Batch çağrı başlatıldı | ${recipients.length} kişi | batchId: ${batchResponse.batchId}`);

    res.status(201).json({
      success:    true,
      batchId:    batchResponse.batchId,
      totalCalls: recipients.length,
      callDbIds,
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Calls] Batch çağrı hatası:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/calls/phone-numbers ────────────────────────────────────────────
// ElevenLabs'a kayıtlı telefon numaralarını getir
callsRouter.get('/phone-numbers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const numbers = await elevenlabsApi.getPhoneNumbers();
    res.json({ success: true, phoneNumbers: numbers });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── GET /api/calls/active ────────────────────────────────────────────────────
callsRouter.get('/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    const { data, error } = await supabase
      .from('calls')
      .select('id, to_number, from_number, status, initiated_at, elevenlabs_conv_id, agent_id')
      .in('status', ['initiated', 'ringing', 'answered', 'in_progress'])
      .order('initiated_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, count: data.length, calls: data });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/calls/:conversationId/hangup ───────────────────────────────────
callsRouter.post('/:conversationId/hangup', async (req: Request, res: Response): Promise<void> => {
  const { conversationId } = req.params;

  try {
    // ElevenLabs conversation'ı sonlandır
    await elevenlabsApi.endConversation(conversationId);

    // DB'yi güncelle
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    await supabase
      .from('calls')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('elevenlabs_conv_id', conversationId);

    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
});
