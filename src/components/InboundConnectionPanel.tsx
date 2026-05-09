/**
 * InboundConnectionPanel
 *
 * Her agent kartından açılan modal — gelen aramayı hangi provider üzerinden
 * alacağını yapılandırır.
 *
 * Provider seçenekleri:
 *   elevenlabs_native — ElevenLabs'ın kendi SIP/PSTN altyapısı
 *   twilio            — Twilio telefon numarası → bu sunucu webhook
 *   sip               — Harici SIP trunk
 *   custom            — Herhangi bir webhook destekli provider
 */

import { useState, useEffect, useCallback } from "react";
import {
  Phone, X, Loader2, CheckCircle2, AlertCircle, Copy, ExternalLink,
  Zap, PhoneCall, Globe, Settings, ChevronRight, TestTube2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderType = "elevenlabs_native" | "twilio" | "sip" | "custom";

interface InboundConnection {
  id: string;
  user_id: string;
  agent_db_id: string | null;
  elevenlabs_agent_id: string;
  provider_type: ProviderType;
  phone_number: string | null;
  config: Record<string, string>;
  is_active: boolean;
  last_tested_at: string | null;
  test_status: "ok" | "error" | "pending" | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  agentId: string;       // ElevenLabs agent ID
  agentDbId?: string;    // Supabase agents.id (optional)
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: Array<{
  type: ProviderType;
  label: string;
  sublabel: string;
  icon: typeof Phone;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    type: "elevenlabs_native",
    label: "ElevenLabs Native",
    sublabel: "ElevenLabs'ın kendi numarası",
    icon: Zap,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  {
    type: "twilio",
    label: "Twilio",
    sublabel: "Twilio telefon numarası",
    icon: PhoneCall,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  {
    type: "sip",
    label: "SIP Trunk",
    sublabel: "Harici SIP sağlayıcı",
    icon: Globe,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  {
    type: "custom",
    label: "Özel Webhook",
    sublabel: "Kendi altyapınız",
    icon: Settings,
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
];

// ─── Copy helper ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-2 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-all active:scale-90 flex-shrink-0"
      title="Kopyala"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Webhook URL box ──────────────────────────────────────────────────────────

function WebhookUrlBox({ label, url }: { label: string; url: string }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
        <code className="text-xs font-mono text-slate-700 flex-1 break-all leading-relaxed">{url}</code>
        <CopyButton text={url} />
      </div>
    </div>
  );
}

// ─── Provider instructions ────────────────────────────────────────────────────

function ProviderInstructions({ provider, webhookUrl, sipUri }: {
  provider: ProviderType;
  webhookUrl: string;
  sipUri: string;
}) {
  switch (provider) {
    case "elevenlabs_native":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl p-4">
            <Zap className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-violet-900 mb-1">ElevenLabs Dashboard'dan yapılandırın</p>
              <p className="text-xs text-violet-700 leading-relaxed">
                ElevenLabs konsoluna gidin → <strong>Phone Numbers</strong> sekmesi → bu agent'a bir numara atayın.
                Numara atandığında gelen aramalar otomatik olarak bu asistana yönlendirilir.
              </p>
            </div>
          </div>
          <a
            href="https://elevenlabs.io/app/conversational-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            ElevenLabs Konsolunu Aç
          </a>
        </div>
      );

    case "twilio":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
            <PhoneCall className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-900 mb-1">Twilio Konsol Ayarı</p>
              <p className="text-xs text-red-700 leading-relaxed">
                Twilio konsoluna gidin → <strong>Phone Numbers</strong> → kullanmak istediğiniz numarayı seçin →
                <strong> Voice &amp; Fax</strong> sekmesi → <strong>A Call Comes In</strong> alanına aşağıdaki
                URL'yi yapıştırın (Webhook, HTTP POST).
              </p>
            </div>
          </div>
          <WebhookUrlBox label="Twilio Webhook URL" url={webhookUrl} />
          <a
            href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Twilio Konsolunu Aç
          </a>
        </div>
      );

    case "sip":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-sky-50 border border-sky-100 rounded-xl p-4">
            <Globe className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-sky-900 mb-1">SIP Trunk Yapılandırması</p>
              <p className="text-xs text-sky-700 leading-relaxed">
                SIP sağlayıcınızda (Bandwidth, Vonage, 3CX, vb.) aşağıdaki SIP URI'yi
                hedef / trunk olarak tanımlayın. Gelen INVITE paketleri bu asistana yönlendirilecektir.
              </p>
            </div>
          </div>
          <WebhookUrlBox label="SIP URI" url={sipUri} />
        </div>
      );

    case "custom":
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-slate-100 border border-slate-200 rounded-xl p-4">
            <Settings className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800 mb-1">Özel Webhook Entegrasyonu</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sağlayıcınız TwiML veya benzer bir HTTP webhook formatını destekliyorsa aşağıdaki URL'yi
                "gelen arama webhook'u" olarak yapılandırın. Sunucu TwiML yanıt döner.
              </p>
            </div>
          </div>
          <WebhookUrlBox label="Webhook URL" url={webhookUrl} />
        </div>
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboundConnectionPanel({ agentId, agentDbId, agentName, isOpen, onClose }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [connection, setConnection] = useState<InboundConnection | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("twilio");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [sipUri, setSipUri] = useState("");

  const [saveMsg, setSaveMsg]   = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Load existing connection & webhook URL ────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    setSaveMsg(null);
    setTestResult(null);
    try {
      // Fetch user's connections for this agent
      const res = await apiFetch<{ success: boolean; connections: InboundConnection[] }>(
        "/api/inbound/connections"
      );
      const conn = res.connections.find(c => c.elevenlabs_agent_id === agentId);
      if (conn) {
        setConnection(conn);
        setSelectedProvider(conn.provider_type);
        setPhoneNumber(conn.phone_number ?? "");
        setIsActive(conn.is_active);
      } else {
        setConnection(null);
        setSelectedProvider("twilio");
        setPhoneNumber("");
        setIsActive(true);
      }

      // Fetch webhook/sip URLs
      const urlRes = await apiFetch<{ success: boolean; webhookUrl: string; sipUri: string }>(
        "/api/inbound/webhook-url"
      );
      setWebhookUrl(urlRes.webhookUrl);
      setSipUri(urlRes.sipUri);
    } catch {
      // silently ignore — connection simply won't be pre-filled
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      if (connection) {
        // Update existing
        await apiFetch(`/api/inbound/connections/${connection.id}`, {
          method: "PUT",
          body: JSON.stringify({
            provider_type: selectedProvider,
            phone_number:  phoneNumber || null,
            is_active:     isActive,
          }),
        });
      } else {
        // Create new
        const newConn = await apiFetch<{ success: boolean; connection: InboundConnection }>(
          "/api/inbound/connections",
          {
            method: "POST",
            body: JSON.stringify({
              elevenlabs_agent_id: agentId,
              agent_db_id:        agentDbId ?? null,
              provider_type:      selectedProvider,
              phone_number:       phoneNumber || null,
              config:             {},
            }),
          }
        );
        setConnection(newConn.connection);
      }
      setSaveMsg({ type: "ok", text: "Bağlantı kaydedildi." });
    } catch (err: any) {
      setSaveMsg({ type: "error", text: err.message ?? "Kayıt başarısız." });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Test ──────────────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!connection) {
      setTestResult({ ok: false, message: "Önce bağlantıyı kaydedin." });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{ success: boolean; ok: boolean; message: string }>(
        `/api/inbound/connections/${connection.id}/test`,
        { method: "POST" }
      );
      setTestResult({ ok: res.ok, message: res.message });
      // refresh to update test_status
      await load();
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message ?? "Test başarısız." });
    } finally {
      setIsTesting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!connection) return;
    if (!window.confirm("Bu bağlantıyı silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/api/inbound/connections/${connection.id}`, { method: "DELETE" });
      setConnection(null);
      setPhoneNumber("");
      setIsActive(true);
      setSaveMsg({ type: "ok", text: "Bağlantı silindi." });
    } catch (err: any) {
      setSaveMsg({ type: "error", text: err.message ?? "Silme başarısız." });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 relative flex flex-col max-h-[90vh]">

        {/* Header accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#CCFF00]" />

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-slate-100 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
              <Phone className="w-5 h-5 text-[#CCFF00]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Gelen Arama Bağlantısı</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5 truncate max-w-[240px]">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm active:scale-90 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Yükleniyor...</p>
            </div>
          ) : (
            <div className="px-7 py-6 space-y-6">

              {/* Existing connection badge */}
              {connection && (
                <div className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold",
                  connection.is_active
                    ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                    : "bg-amber-50 border border-amber-100 text-amber-700"
                )}>
                  <div className={cn("w-2 h-2 rounded-full", connection.is_active ? "bg-emerald-500" : "bg-amber-400")} />
                  {connection.is_active ? "Aktif bağlantı mevcut" : "Bağlantı pasif"}
                  {connection.test_status === "ok" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Test başarılı
                    </span>
                  )}
                  {connection.test_status === "error" && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" /> Test başarısız
                    </span>
                  )}
                </div>
              )}

              {/* Provider selector */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Provider Seç</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map(p => {
                    const Icon = p.icon;
                    const active = selectedProvider === p.type;
                    return (
                      <button
                        key={p.type}
                        onClick={() => setSelectedProvider(p.type)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                          active
                            ? `${p.bg} ${p.border} ring-2 ring-offset-1 ${p.border.replace("border-", "ring-")}`
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 flex-shrink-0", active ? p.color : "text-slate-400")} />
                        <div className="min-w-0">
                          <p className={cn("text-xs font-black truncate", active ? p.color : "text-slate-700")}>{p.label}</p>
                          <p className="text-[10px] text-slate-400 font-medium truncate">{p.sublabel}</p>
                        </div>
                        {active && <ChevronRight className={cn("w-3.5 h-3.5 ml-auto flex-shrink-0", p.color)} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone number (optional, Twilio & custom mostly) */}
              {(selectedProvider === "twilio" || selectedProvider === "sip") && (
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Telefon Numarası {selectedProvider === "twilio" ? "(E.164 formatı)" : "(SIP URI — opsiyonel)"}
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder={selectedProvider === "twilio" ? "+905XXXXXXXXX" : "+905XXXXXXXXX veya sip:..."}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {selectedProvider === "twilio"
                      ? "Twilio konsolundaki numaranızı bu alana girin. Webhook eşleşmesi bu numaraya göre yapılır."
                      : "Opsiyonel — kayıt ve eşleşme amacıyla kullanılır."}
                  </p>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-bold text-slate-800">Bağlantı Aktif</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pasif durumdayken gelen aramalar bu asistana yönlendirilmez.</p>
                </div>
                <button
                  onClick={() => setIsActive(v => !v)}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors flex-shrink-0",
                    isActive ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-7" : "translate-x-1"
                  )} />
                </button>
              </div>

              {/* Instructions */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Kurulum Adımları</p>
                <ProviderInstructions
                  provider={selectedProvider}
                  webhookUrl={webhookUrl}
                  sipUri={sipUri}
                />
              </div>

              {/* Save message */}
              {saveMsg && (
                <div className={cn(
                  "flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold",
                  saveMsg.type === "ok"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                    : "bg-red-50 border-red-100 text-red-700"
                )}>
                  {saveMsg.type === "ok"
                    ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  {saveMsg.text}
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className={cn(
                  "flex items-start gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold",
                  testResult.ok
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                    : "bg-amber-50 border-amber-100 text-amber-700"
                )}>
                  {testResult.ok
                    ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                    : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isLoading && (
          <div className="px-7 py-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
            {/* Delete — only if connection exists */}
            {connection && (
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-90"
                title="Bağlantıyı Sil"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Test */}
            <button
              onClick={handleTest}
              disabled={isTesting || !connection}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all",
                connection
                  ? "border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 active:scale-95"
                  : "border-slate-100 text-slate-300 cursor-not-allowed"
              )}
            >
              {isTesting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <TestTube2 className="w-4 h-4" />}
              Test Et
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all shadow-[0_4px_16px_rgba(15,23,42,0.12)]",
                isSaving
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 active:scale-95"
              )}
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
                : <><CheckCircle2 className="w-4 h-4" /> Kaydet</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
