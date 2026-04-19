import { useEffect, useState } from "react";
import {
    X, Phone, BrainCircuit, Loader2, CheckCircle2, AlertCircle,
    PhoneCall, Hash,
} from "lucide-react";
import {
    getAgents, getPhoneNumbers, makeOutboundCall,
    AgentListItem, PhoneNumberItem,
} from "@/services/elevenlabsApi";
import { cn } from "@/utils/cn";

interface QuickCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-selected agent id (optional). */
    defaultAgentId?: string;
}

const normalizePhone = (raw: string): string => {
    let p = raw.replace(/[^\d+]/g, "");
    if (!p) return "";
    if (!p.startsWith("+")) {
        // Assume Turkey if a leading 0 or 90 is present
        if (p.startsWith("90")) p = "+" + p;
        else if (p.startsWith("0")) p = "+9" + p;
        else p = "+" + p;
    }
    return p;
};

const isValidPhone = (p: string) => /^\+\d{10,15}$/.test(p);

export const QuickCallModal = ({ isOpen, onClose, defaultAgentId }: QuickCallModalProps) => {
    const [agents, setAgents] = useState<AgentListItem[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberItem[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);

    const [agentId, setAgentId] = useState("");
    const [phoneNumberId, setPhoneNumberId] = useState("");
    const [toNumber, setToNumber] = useState("");

    const [isCalling, setIsCalling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSuccess(null);
        setLoadingLists(true);
        Promise.all([
            getAgents().catch(() => []),
            getPhoneNumbers().catch(() => []),
        ]).then(([a, pn]) => {
            setAgents(a);
            setPhoneNumbers(pn);
            setAgentId(defaultAgentId || a[0]?.agent_id || "");
            setPhoneNumberId(pn[0]?.phone_number_id || "");
            setLoadingLists(false);
        });
    }, [isOpen, defaultAgentId]);

    const canCall =
        !!agentId &&
        !!phoneNumberId &&
        isValidPhone(normalizePhone(toNumber)) &&
        !isCalling;

    const handleCall = async () => {
        const normalized = normalizePhone(toNumber);
        if (!isValidPhone(normalized)) {
            setError("Numara formatı geçersiz. Örn: +905xxxxxxxxx");
            return;
        }
        setError(null);
        setSuccess(null);
        setIsCalling(true);
        try {
            const result = await makeOutboundCall(agentId, phoneNumberId, normalized);
            setSuccess(
                result.conversation_id
                    ? `Arama başlatıldı. Conversation ID: ${result.conversation_id}`
                    : "Arama başlatıldı."
            );
            setToNumber("");
        } catch (err: any) {
            setError(err.message || "Arama başlatılamadı.");
        } finally {
            setIsCalling(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#CCFF00] to-emerald-400" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#CCFF00] flex items-center justify-center shadow-lg">
                            <PhoneCall className="w-5 h-5 text-slate-900" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Hızlı Arama</h2>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">Tek numarayı seçtiğin ajan ile hemen arat</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isCalling}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-5 flex-1">

                    {loadingLists ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Agent */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                    <BrainCircuit className="w-3.5 h-3.5" /> Asistan
                                </label>
                                {agents.length === 0 ? (
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                        Henüz kayıtlı bir asistan yok.
                                    </div>
                                ) : (
                                    <select
                                        value={agentId}
                                        onChange={e => setAgentId(e.target.value)}
                                        disabled={isCalling}
                                        className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                    >
                                        {agents.map(a => (
                                            <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Phone number */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> Arama Yapacak Hat
                                </label>
                                {phoneNumbers.length === 0 ? (
                                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                        Hiç kayıtlı telefon numarası yok. Önce ElevenLabs workspace'ten bir numara bağlayın.
                                    </div>
                                ) : (
                                    <select
                                        value={phoneNumberId}
                                        onChange={e => setPhoneNumberId(e.target.value)}
                                        disabled={isCalling}
                                        className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                    >
                                        {phoneNumbers.map(p => (
                                            <option key={p.phone_number_id} value={p.phone_number_id}>
                                                {p.phone_number} {p.label ? `— ${p.label}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* To number */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5" /> Aranacak Numara
                                </label>
                                <input
                                    type="tel"
                                    value={toNumber}
                                    onChange={e => setToNumber(e.target.value)}
                                    placeholder="+90 555 123 45 67"
                                    disabled={isCalling}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-lg font-mono font-bold text-slate-800 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none tracking-wider"
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && canCall) handleCall();
                                    }}
                                />
                                {toNumber && (
                                    <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
                                        Aranacak: <span className="font-bold text-slate-600">{normalizePhone(toNumber) || "—"}</span>
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div className="text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                                </div>
                            )}

                            {success && (
                                <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {success}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isCalling}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        Kapat
                    </button>
                    <button
                        onClick={handleCall}
                        disabled={!canCall}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all shadow-[0_8px_20px_rgba(204,255,0,0.2)]",
                            !canCall
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                : "bg-[#CCFF00] text-slate-900 hover:bg-[#b8f000] hover:-translate-y-0.5 active:scale-95"
                        )}
                    >
                        {isCalling ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Aranıyor...
                            </>
                        ) : (
                            <>
                                <PhoneCall className="w-4 h-4" /> Aramayı Başlat
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
