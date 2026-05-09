/**
 * Inbound Connection Routes — Provider-Agnostic Routing
 *
 * Her agent için hangi provider üzerinden gelen arama alacağını yönetir.
 * Provider: elevenlabs_native | twilio | sip | custom
 *
 * GET    /api/inbound/connections
 * POST   /api/inbound/connections
 * PUT    /api/inbound/connections/:id
 * DELETE /api/inbound/connections/:id
 * POST   /api/inbound/connections/:id/test
 *
 * GET    /api/inbound/webhook-url   — Bu sunucunun Twilio webhook URL'ini döndür
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import { config } from '../config';
import { elevenlabsApi } from '../services/elevenlabs';

export const inboundRouter = Router();

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// ─── GET /api/inbound/connections ────────────────────────────────────────────
inboundRouter.get('/connections', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  try {
    const { data, error } = await supabase
      .from('inbound_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, connections: data });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/inbound/connections ───────────────────────────────────────────
inboundRouter.post('/connections', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const { elevenlabs_agent_id, agent_db_id, provider_type, phone_number, config: connConfig } = req.body;

  if (!elevenlabs_agent_id || !provider_type) {
    res.status(400).json({ error: 'elevenlabs_agent_id ve provider_type zorunludur' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('inbound_connections')
      .insert({
        user_id: userId,
        elevenlabs_agent_id,
        agent_db_id:   agent_db_id   || null,
        provider_type,
        phone_number:  phone_number  || null,
        config:        connConfig    || {},
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, connection: data });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/inbound/connections/:id ────────────────────────────────────────
inboundRouter.put('/connections/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const { id } = req.params;
  const { provider_type, phone_number, config: connConfig, is_active } = req.body;

  try {
    const { data, error } = await supabase
      .from('inbound_connections')
      .update({
        ...(provider_type !== undefined && { provider_type }),
        ...(phone_number  !== undefined && { phone_number }),
        ...(connConfig    !== undefined && { config: connConfig }),
        ...(is_active     !== undefined && { is_active }),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) { res.status(404).json({ error: 'Connection not found' }); return; }
    res.json({ success: true, connection: data });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/inbound/connections/:id ─────────────────────────────────────
inboundRouter.delete('/connections/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('inbound_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/inbound/connections/:id/test ──────────────────────────────────
inboundRouter.post('/connections/:id/test', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const { id } = req.params;

  try {
    const { data: conn, error: fetchErr } = await supabase
      .from('inbound_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !conn) { res.status(404).json({ error: 'Connection not found' }); return; }

    let testOk = false;
    let testMessage = '';

    switch (conn.provider_type) {
      case 'elevenlabs_native': {
        // ElevenLabs API'dan agent'ın var olduğunu doğrula
        try {
          const numbers = await elevenlabsApi.getPhoneNumbers();
          const assigned = numbers.some(n => n.assigned_agent?.agent_id === conn.elevenlabs_agent_id);
          testOk = assigned;
          testMessage = assigned
            ? 'Agent\'e atanmış aktif bir ElevenLabs numarası bulundu.'
            : 'Agent\'e atanmış numara bulunamadı. ElevenLabs dashboard\'dan numara atayın.';
        } catch {
          testOk = false;
          testMessage = 'ElevenLabs API\'sine ulaşılamadı.';
        }
        break;
      }

      case 'twilio': {
        const webhookUrl = `${config.serverUrl}/twiml/inbound`;
        testOk = true;
        testMessage = `Twilio konsolunda Voice URL olarak şunu ayarlayın: ${webhookUrl}`;
        break;
      }

      case 'sip': {
        testOk = true;
        testMessage = 'SIP bağlantısı kaydedildi. SIP sağlayıcınızda bu URI\'yi hedef olarak ayarlayın.';
        break;
      }

      case 'custom': {
        const webhookUrl = `${config.serverUrl}/twiml/inbound`;
        testOk = true;
        testMessage = `Webhook URL: ${webhookUrl}. Sağlayıcınızda bu URL\'yi yapılandırın.`;
        break;
      }

      default:
        testMessage = 'Bilinmeyen provider tipi.';
    }

    // Test sonucunu DB'ye kaydet
    await supabase
      .from('inbound_connections')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status:    testOk ? 'ok' : 'error',
      })
      .eq('id', id);

    res.json({ success: true, ok: testOk, message: testMessage });
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/inbound/webhook-url ────────────────────────────────────────────
// Twilio / custom webhook için kullanılacak URL'i döndür
inboundRouter.get('/webhook-url', (_req: Request, res: Response) => {
  res.json({
    success:     true,
    webhookUrl:  `${config.serverUrl}/twiml/inbound`,
    sipUri:      `sip:${config.serverUrl.replace('https://', '').replace('http://', '')}`,
    description: 'Twilio veya SIP sağlayıcınızda gelen aramaları bu adrese yönlendirin.',
  });
});
