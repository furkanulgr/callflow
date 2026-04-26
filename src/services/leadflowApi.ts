/**
 * LeadFlow Integration — Supabase Direct Client
 *
 * Key yönetimi ve lead listesi için bridge server'a gerek yok,
 * Supabase anon key ile direkt çalışır.
 *
 * Sadece LeadFlow'dan lead ALMAK için bridge server gerekli
 * (o endpoint LeadFlow tarafından çağrılır, frontend'den değil).
 */

import { supabase } from "@/lib/supabase";

// Şimdilik sabit org_id — auth eklenince session'dan gelir
export const DEFAULT_ORG_ID = "lueratech";

export interface LeadflowConnection {
    id: string;
    api_key: string;
    name: string;
    active: boolean;
    created_at: string;
    last_used_at: string | null;
}

export interface LeadflowContact {
    id: string;
    name: string;
    phone: string;
    email?: string;
    source: string;
    tags?: string[];
    custom_data?: Record<string, unknown>;
    leadflow_id?: string;
    created_at: string;
}

/* ── Key Yönetimi ─────────────────────────────────────────── */

/** Mevcut aktif API key'i getir */
export async function getLeadflowKey(orgId = DEFAULT_ORG_ID): Promise<LeadflowConnection | null> {
    const { data } = await supabase
        .from("leadflow_connections")
        .select("id, api_key, name, active, created_at, last_used_at")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    return data ?? null;
}

/** Yeni API key üret — eskiyi pasife al, yeni key aç */
export async function generateLeadflowKey(orgId = DEFAULT_ORG_ID): Promise<LeadflowConnection> {
    // Mevcut aktif key'leri pasife al
    await supabase
        .from("leadflow_connections")
        .update({ active: false })
        .eq("organization_id", orgId)
        .eq("active", true);

    // Yeni key oluştur
    const { data, error } = await supabase
        .from("leadflow_connections")
        .insert({
            organization_id: orgId,
            name: "LeadFlow Integration",
            active: true,
        })
        .select("id, api_key, name, active, created_at, last_used_at")
        .single();

    if (error || !data) throw new Error(error?.message ?? "Key oluşturulamadı");
    return data;
}

/** Aktif key'i iptal et */
export async function revokeLeadflowKey(orgId = DEFAULT_ORG_ID): Promise<void> {
    await supabase
        .from("leadflow_connections")
        .update({ active: false })
        .eq("organization_id", orgId)
        .eq("active", true);
}

/* ── Lead Listesi ─────────────────────────────────────────── */

/** LeadFlow'dan gelen contactları getir */
export async function getLeadflowLeads(
    orgId = DEFAULT_ORG_ID,
    opts: { limit?: number; offset?: number } = {}
): Promise<{ leads: LeadflowContact[]; total: number }> {
    const from = opts.offset ?? 0;
    const to   = from + (opts.limit ?? 100) - 1;

    const { data, count, error } = await supabase
        .from("contacts")
        .select("id, name, phone, email, source, tags, custom_data, leadflow_id, created_at", { count: "exact" })
        .eq("organization_id", orgId)
        .eq("source", "leadflow")
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) throw new Error(error.message);
    return { leads: data ?? [], total: count ?? 0 };
}
