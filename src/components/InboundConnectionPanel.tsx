/**
 * InboundConnectionPanel — Sadeleştirilmiş
 *
 * Müşteri sadece telefon numarasını girer.
 * Provider, webhook, SIP gibi teknik detaylar gizlendi.
 */

import { useState, useEffect, useCallback } from "react";
import { Phone, X, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative">

        {/* Top accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#CCFF00]" />

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
              <Phone className="w-5 h-5 text-[#CCFF00]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Gelen Arama</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5 truncate max-w-[220px]">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-7">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-7 h-7 text-slate-300 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Durum badge */}
              {connection && (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold",
                  connection.is_active
                    ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                    : "bg-amber-50 border border-amber-100 text-amber-700"
                )}>
                  <div className={cn("w-2 h-2 rounded-full", connection.is_active ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
                  {connection.is_active ? "Gelen aramalar bu asistana yönlendiriliyor" : "Bağlantı pasif"}
                </div>
              )}

              {/* Telefon numarası */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+90 5XX XXX XX XX"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-base font-bold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none transition-all tracking-wide"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Bu numaraya gelen tüm aramalar otomatik olarak <span className="font-semibold text-slate-600">{agentName}</span> asistanına bağlanır.
                </p>
              </div>

              {/* Aktif toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-bold text-slate-800">Bağlantı Aktif</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pasifken gelen aramalar yönlendirilmez</p>
                </div>
                <button
                  onClick={() => setIsActive(v => !v)}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors flex-shrink-0",
                    isActive ? "bg-emerald-500" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-7" : "translate-x-1"
                  )} />
                </button>
              </div>

              {/* Mesaj */}
              {saveMsg && (
                <div className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold",
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

        {/* Footer */}
        {!isLoading && (
          <div className="px-7 pb-7 flex items-center gap-3">
            {connection && (
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                title="Bağlantıyı Kaldır"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "ml-auto flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all shadow-[0_4px_16px_rgba(15,23,42,0.12)]",
                isSaving
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
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
