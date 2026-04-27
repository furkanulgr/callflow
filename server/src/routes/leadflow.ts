/**
 * LeadFlow Integration Routes (User-scoped Multi-tenant)
 *
 * LeadFlow → CallFlow lead aktarım köprüsü.
 * API key ile authenticate olan LeadFlow instance'ı bu endpoint'e POST atar.
 * Server, key'in sahibi user_id'yi bulup contacts tablosuna user_id ile yazar.
 *
 * POST /api/leadflow/receive  — LeadFlow'dan lead al (Bearer token gerekli)
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

  // Key'i doğrula, user_id'yi al
  const { data: conn, error: connError } = await supabase
    .from('leadflow_connections')
    .select('id, user_id')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();

  if (connError || !conn || !conn.user_id) {
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
      .eq('user_id', conn.user_id)
      .eq('leadflow_id', leadflow_id)
      .maybeSingle();

    if (existing) {
      res.json({ success: true, contact_id: existing.id, duplicate: true });
      return;
    }
  }

  // contacts tablosuna ekle (user_id ile)
  const { data: contact, error: insertError } = await supabase
    .from('contacts')
    .insert({
      user_id:     conn.user_id,
      name:        name ?? phone,
      phone,
      email:       email ?? null,
      source:      source ?? 'leadflow',
      tags:        tags ?? [],
      custom_data: custom_fields ?? {},
      leadflow_id: leadflow_id ?? null,
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

  console.log(`[LeadFlow] ✅ Lead alındı | user: ${conn.user_id} | phone: ${phone}`);
  res.status(201).json({ success: true, contact_id: contact.id });
});

/* ── POST /api/leadflow/receive-bulk ───────────────────────── */
// Birden fazla lead'i tek seferde gönder
leadflowRouter.post('/receive-bulk', async (req: Request, res: Response): Promise<void> => {
  const apiKey = extractBearer(req);

  if (!apiKey) {
    res.status(401).json({ error: 'Authorization header eksik.' });
    return;
  }

  const { data: conn, error: connError } = await supabase
    .from('leadflow_connections')
    .select('id, user_id')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();

  if (connError || !conn || !conn.user_id) {
    res.status(401).json({ error: 'Geçersiz veya pasif API key.' });
    return;
  }

  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    res.status(400).json({ error: 'leads dizisi boş olamaz.' });
    return;
  }

  // Mevcut leadflow_id'leri al (deduplicate için)
  const incomingIds = leads.map((l: any) => l.leadflow_id).filter(Boolean);
  const { data: existing } = await supabase
    .from('contacts')
    .select('leadflow_id')
    .eq('user_id', conn.user_id)
    .in('leadflow_id', incomingIds);

  const existingIds = new Set((existing ?? []).map((e: any) => e.leadflow_id));
  const newLeads = leads.filter((l: any) => !l.leadflow_id || !existingIds.has(l.leadflow_id));

  if (newLeads.length === 0) {
    res.json({ success: 0, duplicate: leads.length, fail: 0 });
    return;
  }

  const rows = newLeads.map((l: any) => ({
    user_id:     conn.user_id,
    name:        l.name ?? l.phone,
    phone:       l.phone,
    email:       l.email ?? null,
    source:      l.source ?? 'leadflow',
    tags:        l.tags ?? [],
    custom_data: l.custom_fields ?? {},
    leadflow_id: l.leadflow_id ?? null,
  }));

  const { error: insertError } = await supabase
    .from('contacts')
    .insert(rows);

  if (insertError) {
    console.error('[LeadFlow] Bulk insert error:', insertError.message);
    res.status(500).json({ error: 'Toplu kayıt başarısız.' });
    return;
  }

  await supabase
    .from('leadflow_connections')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', conn.id);

  console.log(`[LeadFlow] ✅ Toplu lead alındı | user: ${conn.user_id} | yeni: ${newLeads.length} | duplicate: ${existingIds.size}`);
  res.status(201).json({
    success: newLeads.length,
    duplicate: existingIds.size,
    fail: 0,
  });
});

/* ── GET /api/leadflow/health ──────────────────────────────── */
leadflowRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
