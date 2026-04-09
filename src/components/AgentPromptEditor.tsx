import { useState, useEffect } from "react";
import { getAgentConfigData, updateAgentConfigData } from "@/services/elevenlabsApi";
import { Save, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface AgentPromptEditorProps {
    agentId?: string;
    agentRole?: string;
    apiKey?: string;
}

export const AgentPromptEditor = ({ agentId, agentRole, apiKey }: AgentPromptEditorProps) => {
    const [prompt, setPrompt] = useState("");
    const [firstMessage, setFirstMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!agentId) return;
        
        let isMounted = true;
        const fetchPrompt = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const configData = await getAgentConfigData(agentId, apiKey);
                if (isMounted) {
                    setPrompt(configData.prompt);
                    setFirstMessage(configData.firstMessage);
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || "Ajan bilgileri alınamadı.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchPrompt();

        return () => { isMounted = false; };
    }, [agentId]);

    const handleSave = async () => {
        if (!agentId || !prompt.trim()) return;

        setIsSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await updateAgentConfigData(agentId, prompt, firstMessage, apiKey);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Kaydedilirken hata oluştu.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!agentId) {
        return (
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-orange-800">Ajan Tanımlı Değil</h4>
                    <p className="text-xs text-orange-600 mt-1">Bu kampanya için geçerli bir Asistan ID'si bulunmuyor.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative">
            <h4 className="text-base font-black text-slate-900 mb-2 flex items-center justify-between">
                <div>
                    Davranış ve Konuşma Profili
                    {agentRole && <span className="ml-2 text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded-lg">{agentRole}</span>}
                </div>
                {success && <span className="text-xs font-bold text-emerald-500 animate-in fade-in">Başarıyla Kaydedildi ✓</span>}
            </h4>
            <p className="text-xs text-slate-500 mb-4">
                Asistanın çağrı başlangıç mesajını ve sistemi yönetecek olan davranış karakterini (prompt) buradan canlı olarak güncelleyebilirsiniz.
            </p>

            {isLoading ? (
                <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center border border-slate-200">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
            ) : (
                <div className="relative flex flex-col gap-6">
                    {/* First Message Edit Box */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">İlk Mesaj (Açılış Cümlesi)</label>
                        <p className="text-[11px] text-slate-500 mb-2">Asistan çağrı başladığında karşı tarafa ilk bu cümleyi söyleyecek.</p>
                        <textarea
                            value={firstMessage}
                            onChange={(e) => setFirstMessage(e.target.value)}
                            className="w-full h-24 p-3.5 rounded-xl bg-white border border-slate-300 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-sm custom-scrollbar"
                            placeholder="Merhaba, size nasıl yardımcı olabilirim?"
                            disabled={isSaving}
                        />
                    </div>

                    {/* Prompt Edit Box */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Ajan Karakteri (System Prompt)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-64 p-4 rounded-xl bg-white border border-slate-300 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-inner custom-scrollbar"
                            placeholder="Ajan talimatlarını girin..."
                            disabled={isSaving}
                        />
                    </div>
                    
                    {error && (
                        <div className="mt-3 text-xs text-red-500 font-semibold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <div className="flex justify-end mt-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !prompt.trim()}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm",
                                isSaving || !prompt.trim() 
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Değişiklikleri Publish Et
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
