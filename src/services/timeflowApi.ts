import { supabase } from "@/lib/supabase";

export interface TimeflowConnection {
    id: string;
    api_key: string;
    name: string;
    active: boolean;
    created_at: string;
    last_used_at: string | null;
}

async function currentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Oturum açık değil");
    return user.id;
}

/** Aktif TimeFlow key'ini getir */
export async function getTimeflowKey(): Promise<TimeflowConnection | null> {
    const userId = await currentUserId();
    const { data } = await supabase
        .from("timeflow_connections")
        .select("id, api_key, name, active, created_at, last_used_at")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    return data ?? null;
}

/** Yeni key üret — eskiyi pasife al */
export async function generateTimeflowKey(): Promise<TimeflowConnection> {
    const userId = await currentUserId();
    await supabase
        .from("timeflow_connections")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);

    const { data, error } = await supabase
        .from("timeflow_connections")
        .insert({ user_id: userId, name: "TimeFlow Integration" })
        .select("id, api_key, name, active, created_at, last_used_at")
        .single();

    if (error || !data) throw new Error(error?.message ?? "Key oluşturulamadı");
    return data;
}

/** Aktif key'i iptal et */
export async function revokeTimeflowKey(): Promise<void> {
    const userId = await currentUserId();
    await supabase
        .from("timeflow_connections")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);
}

/** TimeFlow'dan gelen key'i organization_settings'e kaydet */
export async function saveTimeflowIncomingKey(key: string): Promise<void> {
    const userId = await currentUserId();
    await supabase
        .from("organization_settings")
        .upsert({ user_id: userId, timeflow_api_key: key || null }, { onConflict: "user_id" });
}

/** Kayıtlı TimeFlow incoming key'ini getir */
export async function getTimeflowIncomingKey(): Promise<string | null> {
    const userId = await currentUserId();
    const { data } = await supabase
        .from("organization_settings")
        .select("timeflow_api_key")
        .eq("user_id", userId)
        .maybeSingle();
    return data?.timeflow_api_key ?? null;
}

/** Gateway üzerinden bağlantıyı test et */
export async function testTimeflowConnection(key: string): Promise<boolean> {
    try {
        const res = await fetch("https://n8n.vps.lueratech.com/webhook/gateway/v1/event", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`,
            },
            body: JSON.stringify({ event_type: "ping", source_module: "callflow" }),
        });
        return res.ok || res.status === 400 || res.status === 422;
    } catch {
        return false;
    }
}
