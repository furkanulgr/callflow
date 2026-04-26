/**
 * LeadFlow Integration Routes
 *
 * LeadFlow → CallFlow lead aktarım köprüsü.
 * API key ile authenticate olan LeadFlow instance'ı bu endpoint'e POST atar.
 *
 * POST /api/leadflow/receive          — LeadFlow'dan lead al (Bearer token)
 * POST /api/leadflow/key/generate     — Yeni API key üret
 * GET  /api/leadflow/key/:orgId       — Mevcut key'i getir
 * POST /api/leadflow/key/:orgId/revoke — Key'i iptal et
 * GET  /api/leadflow/leads/:orgId     — Henüz kampanyaya atanmamış leadleri listele
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';

export const leadflowRouter = Router();

/* ── Yardımcı: Bearer token'ı header'dan çıkar ─────────────── */
function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

/* ── POST /api/leadflow/receive ─────────────────────────────── */
// LeadFlow bu endpoint'e her yeni lead için POST atar.
// Header: Authorization: Bearer <api_key>
// Body: { name, phone, email?, source?, tags?, custom_fields?, leadflow_id? }
leadflowRouter.post('/receive', async (req: Request, res: Response): Promise<void> => {
  const apiKey = extractBearer(req);

  if (!apiKey) {
    res.status(401).json({ error: 'Authorization header eksik. Bearer token gerekli.' });
    return;
  }

  // Key'i doğrula, organization_id'yi al
  const { data: conn, error: connError } = await supabase
    .from('leadflow_connections')
    .select('id, organization_id')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();

  if (connError || !conn) {
    res.status(401).json({ error: 'Geçersiz veya pasif API key.' });
    return;
  }

  const { name, phone, email, source, tags, custom_fields, leadflow_id } = req.body;

  if (!phone) {
    res.status(400).json({ error: 'phone alanı zorunludur.' });
    return;
  }

  // Aynı lead tekrar gelmesin (leadflow_id üzerinden deduplicate)
  if (leadflow_id) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', conn.organization_id)
      .eq('leadflow_id', leadflow_id)
      .maybeSingle();

    if (existing) {
      res.json({ success: true, contact_id: existing.id, duplicate: true });
      return;
    }
  }

  // contacts tablosuna ekle
  const { data: contact, error: insertError } = await supabase
    .from('contacts')
    .insert({
      organization_id: conn.organization_id,
      name:            name ?? phone,
      phone,
      email:           email ?? null,
      source:          source ?? 'leadflow',
      tags:            tags ?? [],
      custom_data:     custom_fields ?? {},
      leadflow_id:     leadflow_id ?? null,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[LeadFlow] Insert error:', insertError.message);
    res.status(500).json({ error: 'Lead kaydedilemedi.' });
    return;
  }

  // Son kullanım zamanını güncelle
  await supabase
    .from('leadflow_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', conn.id);

  res.status(201).json({ success: true, contact_id: contact.id });
});

/* ── POST /api/leadflow/key/generate ───────────────────────── */
// Yeni API key üret (varsa eskiyi pasife al, yeni key aç)
leadflowRouter.post('/key/generate', async (req: Request, res: Response): Promise<void> => {
  const { organization_id, name } = req.body;

  if (!organization_id) {
    res.status(400).json({ error: 'organization_id zorunludur.' });
    return;
  }

  // Mevcut aktif key'leri pasife al
  await supabase
    .from('leadflow_connections')
    .update({ active: false })
    .eq('organization_id', organization_id)
    .eq('active', true);

  // Yeni key oluştur
  const { data, error } = await supabase
    .from('leadflow_connections')
    .insert({
      organization_id,
      name: name ?? 'LeadFlow Integration',
      active: true,
    })
    .select('id, api_key, created_at')
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'Key oluşturulamadı.' });
    return;
  }

  res.json({ success: true, api_key: data.api_key, created_at: data.created_at });
});

/* ── GET /api/leadflow/key/:orgId ───────────────────────────── */
leadflowRouter.get('/key/:orgId', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  const { data } = await supabase
    .from('leadflow_connections')
    .select('id, api_key, name, active, created_at, last_used_at')
    .eq('organization_id', orgId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    res.json({ key: null });
    return;
  }

  res.json({ key: data });
});

/* ── POST /api/leadflow/key/:orgId/revoke ───────────────────── */
leadflowRouter.post('/key/:orgId/revoke', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;

  await supabase
    .from('leadflow_connections')
    .update({ active: false })
    .eq('organization_id', orgId)
    .eq('active', true);

  res.json({ success: true });
});

/* ── GET /api/leadflow/leads/:orgId ─────────────────────────── */
// Kampanyaya henüz atanmamış LeadFlow kaynaklı contactları getir
leadflowRouter.get('/leads/:orgId', async (req: Request, res: Response): Promise<void> => {
  const { orgId } = req.params;
  const limit  = parseInt(req.query['limit']  as string ?? '100', 10);
  const offset = parseInt(req.query['offset'] as string ?? '0',   10);

  const { data, error, count } = await supabase
    .from('contacts')
    .select('id, name, phone, email, source, tags, custom_data, leadflow_id, created_at', { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('source', 'leadflow')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ leads: data ?? [], total: count ?? 0 });
});
