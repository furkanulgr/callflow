import { useState, useEffect, useRef } from "react";
import { X, Loader2, Bot, PlusSquare, AlertCircle, Mic, CheckCircle2, Volume2, Square } from "lucide-react";
import { getVoices, VoiceListItem, createAgent } from "@/services/elevenlabsApi";
import { cn } from "@/utils/cn";

interface CreateAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export const CreateAgentModal = ({ isOpen, onClose, onCreated }: CreateAgentModalProps) => {
    const [name, setName] = useState("");
    const [firstMessage, setFirstMessage] = useState("");
    const [prompt, setPrompt] = useState("");
    const [voiceId, setVoiceId] = useState("");
    
    const [voices, setVoices] = useState<VoiceListItem[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Audio Playback
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // Filters
    const [voiceFilter, setVoiceFilter] = useState<"TR" | "ALL">("TR");

    const togglePlay = (voice: VoiceListItem) => {
        if (playingVoiceId === voice.voice_id) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (voice.preview_url) {
                const audio = new Audio(voice.preview_url);
                audioRef.current = audio;
                audio.play().catch(e => console.log("Audio play failed", e));
                setPlayingVoiceId(voice.voice_id);
                audio.onended = () => setPlayingVoiceId(null);
            }
        }
    };

    // Clean up audio on close
    useEffect(() => {
        if (!isOpen) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setPlayingVoiceId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchVoices = async () => {
            setIsLoadingVoices(true);
            try {
                const data = await getVoices();
                if (isMounted) {
                    // Türkçe destekli / global "premade" sesleri listeliyoruz
                    setVoices(data);
                    if (data.length > 0) {
                        setVoiceId(data[0].voice_id); 
                    }
                }
            } catch (err: any) {
                if (isMounted) setError("Ses kütüphanesi yüklenemedi: " + err.message);
            } finally {
                if (isMounted) setIsLoadingVoices(false);
            }
        };

        fetchVoices();
        
        // Reset form
        setName("");
        setFirstMessage("Merhaba, size nasıl yardımcı olabilirim?");
        setPrompt("Sen LUERA sistemine bağlı profesyonel bir asistansın. Kısa ve net cevaplar verirsin.");
        setError(null);

        return () => { isMounted = false; };
    }, [isOpen]);

    const handleCreate = async () => {
        if (!name.trim() || !firstMessage.trim() || !prompt.trim() || !voiceId) {
            setError("Lütfen tüm alanları doldurun.");
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            await createAgent({
                name: name.trim(),
                firstMessage: firstMessage.trim(),
                prompt: prompt.trim(),
                voiceId: voiceId,
            });
            onCreated(); // Callback to refresh grid
            onClose(); // Kapat
        } catch (err: any) {
            setError(err.message || "Asistan yaratılırken bir hata oluştu.");
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 xl:p-8 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-4xl h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden relative border border-slate-100 ring-1 ring-slate-900/5 zoom-in-95 animate-in">
                
                {/* Decorative Header Sparkles */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#CCFF00] to-emerald-400" />

                {/* Modal Header */}
                <div className="px-10 py-8 border-b border-slate-100 flex items-start justify-between bg-white flex-shrink-0">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#CCFF00] flex items-center justify-center shadow-lg transform rotate-2">
                                <PlusSquare className="w-6 h-6 text-slate-900" />
                            </div>
                            <span className="bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-700">Yeni Asistan Yarat</span> 
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-2 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-emerald-500" />
                            LUERA CORE V2 altyapısıyla sıfırdan yapay zeka operatörü oluşturun.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm active:scale-90 disabled:opacity-50"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Editor Component Mount */}
                <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 relative">
                    
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="text-sm font-bold text-red-800">{error}</div>
                        </div>
                    )}

                    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
                        
                        {/* Agent Name */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group focus-within:border-[#CCFF00] transition-colors">
                            <label className="block text-sm font-black text-slate-900 mb-2">Asistan Adı / Rolü</label>
                            <p className="text-[11px] text-slate-500 mb-3">Sistemde listelenecek tanımlayıcı isim (Örn: Derya - Müşteri Temsilcisi).</p>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Asistanın Adı"
                                className="w-full text-lg p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 outline-none transition-all font-bold text-slate-800"
                                disabled={isCreating}
                            />
                        </div>

                        {/* Voice Configuration */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm focus-within:border-[#CCFF00] transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-black text-slate-900">Ses Profili Sentezi</label>
                                {isLoadingVoices && <Loader2 className="w-4 h-4 text-[#CCFF00] animate-spin" />}
                            </div>
                            <p className="text-[11px] text-slate-500 mb-4">Asistanın kimliğini yansıtacak sesi seçin. Karar vermeden önce sesleri dinleyebilirsiniz.</p>
                            
                            {/* Voice Filters */}
                            <div className="flex items-center gap-2 mb-3 bg-slate-100 p-1 rounded-xl w-fit">
                                <button
                                    onClick={() => setVoiceFilter("TR")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        voiceFilter === "TR" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🇹🇷 Türkçe & Özel Sesler
                                </button>
                                <button
                                    onClick={() => setVoiceFilter("ALL")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        voiceFilter === "ALL" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🌍 Tüm Kütüphane
                                </button>
                            </div>

                            <div className="h-64 overflow-y-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white p-2 flex flex-col gap-2 transform-gpu">
                                {voices
                                    .filter(v => voiceFilter === "ALL" || v.labels?.language === "tr" || v.category === "cloned" || v.category === "professional")
                                    .map(v => (
                                    <div 
                                        key={v.voice_id} 
                                        onClick={() => setVoiceId(v.voice_id)}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-colors duration-150",
                                            voiceId === v.voice_id 
                                            ? "bg-[#CCFF00]/10 border-[#CCFF00]" 
                                            : "bg-white border-transparent hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors", 
                                                voiceId === v.voice_id ? "bg-[#CCFF00] text-slate-900 shadow-inner" : "bg-slate-100 text-slate-500"
                                            )}>
                                                <Mic className="w-5 h-5"/>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-800 text-sm leading-tight">{v.name}</span>
                                                <span className="text-xs text-slate-500 mt-0.5 capitalize">
                                                    {v.labels?.gender || "Global"} • {v.labels?.accent || v.category}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {v.preview_url && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); togglePlay(v); }}
                                                className={cn(
                                                    "p-3 rounded-xl transition-colors",
                                                    playingVoiceId === v.voice_id 
                                                    ? "bg-slate-900 text-[#CCFF00]" 
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                                title="Sesi Dinle"
                                            >
                                                {playingVoiceId === v.voice_id ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* First Message */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm focus-within:border-[#CCFF00] transition-colors">
                            <label className="block text-sm font-black text-slate-900 mb-2">İlk Karşılama Cümlesi</label>
                            <p className="text-[11px] text-slate-500 mb-3">Telefon açıldığında asistanın karşı tarafa doğrudan söyleyeceği ilk metin.</p>
                            <textarea
                                value={firstMessage}
                                onChange={(e) => setFirstMessage(e.target.value)}
                                className="w-full h-20 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-inner custom-scrollbar"
                                placeholder="Merhaba, size nasıl yardımcı olabilirim?"
                                disabled={isCreating}
                            />
                        </div>

                        {/* System Prompt */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm focus-within:border-[#CCFF00] transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-black text-slate-900">Ajan Karakteri (System Prompt)</label>
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-md">CORE V2</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">Asistanın zeka sınırlarını, davranış biçimini ve satış/destek kurallarını buradan kodlayın.</p>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full h-48 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-inner custom-scrollbar font-mono text-slate-700"
                                placeholder="Sistem talimatlarını girin..."
                                disabled={isCreating}
                            />
                        </div>

                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-10 py-6 border-t border-slate-100 bg-white flex items-center justify-end gap-4 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        İptal
                    </button>
                    
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !name.trim() || !firstMessage.trim() || !prompt.trim() || !voiceId}
                        className={cn(
                            "flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-[0_8px_20px_rgba(204,255,0,0.2)]",
                            isCreating || !name.trim() || !firstMessage.trim() || !prompt.trim() || !voiceId
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                            : "bg-[#CCFF00] text-slate-900 hover:bg-[#b8f000] hover:-translate-y-0.5 active:scale-95"
                        )}
                    >
                        {isCreating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Sistem İnşa Ediliyor...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-5 h-5" /> Asistanı Sisteme Dahil Et
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
