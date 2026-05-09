/**
 * InboundConnectionPanel — Premium Redesign
 *
 * Müşteri sadece telefon numarasını girer.
 * Provider, webhook, SIP gibi teknik detaylar gizlendi.
 */

import { useState, useEffect, useCallback } from "react";
import { Phone, X, Loader2, CheckCircle2, AlertCircle, Trash2, PhoneIncoming, PhoneOff } from "lucide-react";
import { cn } from "@/utils/cn";
import { apiFetch } from "@/lib/api";

interface InboundConnection {
  id: string;
  elevenlabs_agent_id: string;
  agent_db_id: string | null;
  provider_type: string;
  phone_number: string | null;
  is_active: boolean;
  test_status: "ok" | "error" | "pending" | null;
  created_at: string;
}

interface Props {
  agentId: string;
  agentDbId?: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InboundConnectionPanel({ agentId, agentDbId, agentName, isOpen, onClose }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving]   = useState(false);

  const [connection, setConnection]   = useState<InboundConnection | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isActive, setIsActive]       = useState(true);
  const [saveMsg, setSaveMsg]         = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setSaveMsg(null);
    try {
      const res = await apiFetch<{ success: boolean; connections: InboundConnection[] }>(
        "/api/inbound/connections"
      );
      const conn = res.connections.find(c => c.elevenlabs_agent_id === agentId);
      if (conn) {
        setConnection(conn);
        setPhoneNumber(conn.phone_number ?? "");
        setIsActive(conn.is_active);
      } else {
        setConnection(null);
        setPhoneNumber("");
        setIsActive(true);
      }
    } catch {
      // sessizce devam
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      if (connection) {
        await apiFetch(`/api/inbound/connections/${connection.id}`, {
          method: "PUT",
          body: JSON.stringify({
            provider_type: "twilio",
            phone_number:  phoneNumber || null,
            is_active:     isActive,
          }),
        });
      } else {
        const res = await apiFetch<{ success: boolean; connection: InboundConnection }>(
          "/api/inbound/connections",
          {
            method: "POST",
            body: JSON.stringify({
              elevenlabs_agent_id: agentId,
              agent_db_id:        agentDbId ?? null,
              provider_type:      "twilio",
              phone_number:       phoneNumber || null,
              config:             {},
            }),
          }
        );
        setConnection(res.connection);
      }
      setSaveMsg({ type: "ok", text: "Kaydedildi!" });
    } catch (err: any) {
      setSaveMsg({ type: "error", text: err.message ?? "Kayıt başarısız." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!connection) return;
    if (!window.confirm("Bu gelen arama bağlantısını kaldırmak istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/api/inbound/connections/${connection.id}`, { method: "DELETE" });
      setConnection(null);
      setPhoneNumber("");
      setIsActive(true);
      setSaveMsg({ type: "ok", text: "Bağlantı kaldırıldı." });
    } catch (err: any) {
      setSaveMsg({ type: "error", text: err.message ?? "Silme başarısız." });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl relative bg-white border border-slate-200/80">

        {/* ── Dark Header ───────────────────────────────────── */}
        <div className="relative bg-slate-950 px-6 pt-6 pb-6 overflow-hidden">
          {/* Background radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(204,255,0,0.1),transparent_65%)] pointer-events-none" />
          {/* Top lime line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#CCFF00]/0 via-[#CCFF00] to-[#CCFF00]/0" />

          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/25 flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.1)]">
                <PhoneIncoming className="w-5 h-5 text-[#CCFF00]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight">Gelen Arama</h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate max-w-[180px]">{agentName}</p>
              </div>
            </div>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status pill — only if connection exists */}
          {!isLoading && connection && (
            <div className={cn(
              "relative z-10 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold w-fit",
              connection.is_active
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                connection.is_active ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              )} />
              {connection.is_active ? "Aramalar bu asistana yönlendiriliyor" : "Bağlantı pasif"}
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className="px-6 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Yükleniyor…</p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Phone number input */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Telefon Numarası
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center pointer-events-none">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    autoFocus
                    className="w-full pl-14 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-[#CCFF00] focus:bg-white focus:ring-2 focus:ring-[#CCFF00]/20 outline-none transition-all tracking-wide"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Bu numaraya gelen tüm aramalar otomatik olarak{" "}
                  <span className="font-bold text-slate-600">{agentName}</span>'a bağlanır.
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    isActive ? "bg-emerald-100" : "bg-slate-200"
                  )}>
                    {isActive
                      ? <PhoneIncoming className="w-3.5 h-3.5 text-emerald-600" />
                      : <PhoneOff className="w-3.5 h-3.5 text-slate-400" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-none">Bağlantı Aktif</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isActive ? "Aramalar yönlendiriliyor" : "Aramalar yönlendirilmiyor"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsActive(v => !v)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0",
                    isActive ? "bg-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.4)]" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200",
                    isActive ? "left-[22px]" : "left-0.5"
                  )} />
                </button>
              </div>

              {/* Save / error message */}
              {saveMsg && (
                <div className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold",
                  saveMsg.type === "ok"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                    : "bg-red-50 border-red-100 text-red-700"
                )}>
                  {saveMsg.type === "ok"
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {saveMsg.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        {!isLoading && (
          <div className="px-6 pb-6 flex items-center gap-2.5">
            {/* Delete */}
            {connection && (
              <button
                onClick={handleDelete}
                title="Bağlantıyı Kaldır"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-50 border border-slate-200 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kaldır
              </button>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all",
                isSaving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 active:scale-95 shadow-[0_4px_16px_rgba(15,23,42,0.15)]"
              )}
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor…</>
                : <><CheckCircle2 className="w-4 h-4" /> Kaydet</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
