/**
 * LeadFlow Integration — Supabase Direct Client (User-scoped)
 *
 * Multi-tenant: Her kullanıcı sadece kendi key'ini ve lead'lerini görür.
 * RLS politikaları sayesinde DB seviyesinde izolasyon var.
 */

import { supabase } from "@/lib/supabase";

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

/** Aktif kullanıcının ID'sini al */
async function currentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Oturum açık değil");
    return user.id;
}

/* ── Key Yönetimi ─────────────────────────────────────────── */

/** Mevcut aktif API key'i getir (sadece bu kullanıcının) */
export async function getLeadflowKey(): Promise<LeadflowConnection | null> {
    const userId = await currentUserId();
    const { data } = await supabase
        .from("leadflow_connections")
        .select("id, api_key, name, active, created_at, last_used_at")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    return data ?? null;
}

/** Yeni API key üret — eskiyi pasife al, yeni key aç */
export async function generateLeadflowKey(): Promise<LeadflowConnection> {
    const userId = await currentUserId();

    // Mevcut aktif key'leri pasife al
    await supabase
        .from("leadflow_connections")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);

    // Yeni key oluştur
    const { data, error } = await supabase
        .from("leadflow_connections")
        .insert({
            user_id: userId,
            name: "LeadFlow Integration",
            active: true,
        })
        .select("id, api_key, name, active, created_at, last_used_at")
        .single();

    if (error || !data) throw new Error(error?.message ?? "Key oluşturulamadı");
    return data;
}

/** Aktif key'i iptal et */
export async function revokeLeadflowKey(): Promise<void> {
    const userId = await currentUserId();
    await supabase
        .from("leadflow_connections")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);
}

/* ── Lead Listesi ─────────────────────────────────────────── */

/** LeadFlow'dan gelen contactları getir (sadece bu kullanıcınınkiler) */
export async function getLeadflowLeads(
    opts: { limit?: number; offset?: number } = {}
): Promise<{ leads: LeadflowContact[]; total: number }> {
    const userId = await currentUserId();
    const from = opts.offset ?? 0;
    const to   = from + (opts.limit ?? 100) - 1;

    const { data, count, error } = await supabase
        .from("contacts")
        .select("id, name, phone, email, source, tags, custom_data, leadflow_id, created_at", { count: "exact" })
        .eq("user_id", userId)
        .eq("source", "leadflow")
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) throw new Error(error.message);
    return { leads: data ?? [], total: count ?? 0 };
}
