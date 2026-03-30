import { useState, useEffect, useRef } from "react";
import { Mic, PhoneOff, MicOff, Sparkles, X, Activity, Volume2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { startElevenLabsConversation, ELEVENLABS_AGENT_ID } from "@/utils/elevenlabs";

interface Message {
    id: number;
    speaker: "ai" | "user";
    text: string;
    time: string;
}

export const LiveTestPage = () => {
    // ── STATES ──
    const [duration, setDuration] = useState(0);
    const [status, setStatus] = useState<"ready" | "connecting" | "talking" | "ended">("ready");
    const [isCalling, setIsCalling] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: -1, speaker: "ai", text: "Merhaba! Sistem bağlantısı hazır. Lütfen çağrıyı başlatarak demoya girin.", time: "00:00" }
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const conversationRef = useRef<any>(null);

    // ── ACTIONS ──
    const toggleCall = async () => {
        if (isCalling || status === "connecting") {
            if (conversationRef.current) {
                await conversationRef.current.endSession();
                conversationRef.current = null;
            }
            setStatus("ended");
            setIsCalling(false);
            setIsAiSpeaking(false);
        } else {
            try {
                if (!ELEVENLABS_AGENT_ID) {
                    alert("Asistan ID'si bulunamadı (.env kontrol edin).");
                    return;
                }
                setStatus("connecting");
                setMessages([]);

                const conv = await startElevenLabsConversation({
                    onConnect: () => {
                        console.log("ElevenLabs Call started");
                        setIsCalling(true);
                        setStatus("talking");
                        setDuration(0);
                        setMessages([]); // Clear placeholder
                    },
                    onDisconnect: () => {
                        console.log("ElevenLabs Call ended");
                        setIsCalling(false);
                        setStatus("ended");
                        setIsAiSpeaking(false);
                        conversationRef.current = null;
                    },
                    onError: (err) => {
                        console.error("ElevenLabs error:", err);
                        setIsCalling(false);
                        setStatus("ended");
                        alert("Hata: " + err);
                    },
                    onModeChange: (info) => {
                        setIsAiSpeaking(info.mode === "speaking");
                    },
                    onMessage: (info) => {
                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            speaker: info.source === "ai" ? "ai" : "user",
                            text: info.message,
                            time: formatTime(duration)
                        }]);
                    }
                });

                conversationRef.current = conv;
            } catch (error) {
                console.error("Failed to start call:", error);
                setStatus("ready");
                alert("Çağrı başlatılamadı. Lütfen mikrofon izinlerini kontrol edin.");
            }
        }
    };

    // ── CLEANUP ON UNMOUNT ──
    useEffect(() => {
        return () => {
            if (conversationRef.current) {
                conversationRef.current.endSession();
            }
        };
    }, []);

    // ── TIMER & SCROLL ──
    useEffect(() => {
        if (status !== "talking") return;
        const id = setInterval(() => {
            setDuration(p => p + 1);
        }, 1000);
        return () => clearInterval(id);
    }, [status]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans p-4 md:p-6 lg:p-8">
            {/* ── HEADER ── */}
            <div className="max-w-[1400px] w-full mx-auto mb-6 lg:mb-8">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-4 lg:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-900/20 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
                            <Sparkles className="w-7 h-7 text-[#CCFF00]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                                Canlı AI Testi
                            </h1>
                            <p className="text-sm text-slate-500 font-medium tracking-wide mt-1">
                                Luera AI sesli asistanının tepkiselliğini deneyimleyin.
                            </p>
                        </div>
                    </div>
                    {/* Exit Button */}
                    <button 
                        onClick={() => window.location.href = "/"}
                        className="group w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center hover:bg-red-50 hover:shadow-inner transition-all duration-300"
                    >
                        <X className="w-5 h-5 text-slate-400 group-hover:text-red-500 transition-colors" />
                    </button>
                </div>
            </div>

            {/* ── MAIN CONTENT (Split Layout) ── */}
            <div className="max-w-[1400px] mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8">
                
                {/* ── LEFT: AUDIO CONTROLS (THE ORB) ── */}
                <div className="flex-[1.2] lg:flex-[1.5] relative rounded-[2.5rem] bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl overflow-hidden flex flex-col items-center justify-between p-8 min-h-[500px] lg:min-h-[600px] border border-slate-800">
                    
                    {/* Background Ambient Glow */}
                    <div className={cn(
                        "absolute inset-0 opacity-20 transition-opacity duration-1000",
                        isCalling && isAiSpeaking ? "opacity-40" : ""
                    )}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#CCFF00] rounded-full blur-[160px] opacity-10" />
                    </div>

                    {/* Top Status Bar */}
                    <div className="w-full flex justify-between items-center relative z-10 px-4">
                        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", isCalling ? "bg-red-500 animate-pulse shadow-red-500/50" : "bg-slate-500")} />
                            <span className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">
                                {isCalling ? "LIVE AUDIO" : "STANDBY"}
                            </span>
                        </div>
                        {isCalling && (
                            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/80">
                                <Volume2 className="w-4 h-4 text-[#CCFF00]" />
                                <span className="font-mono text-sm tracking-wider font-semibold">{formatTime(duration)}</span>
                            </div>
                        )}
                    </div>

                    {/* Central Orb Display */}
                    <div className="relative flex-1 flex flex-col items-center justify-center w-full z-10 mt-8 mb-4">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                            
                            {/* Animated Rings for AI Speaking */}
                            {isCalling && (
                                <>
                                    <div className={cn("absolute inset-0 rounded-full border-2 transition-all duration-1000 ease-out", isAiSpeaking ? "border-[#CCFF00]/40 scale-[1.8] opacity-0" : "border-slate-700/50 scale-100 opacity-20")} />
                                    <div className={cn("absolute inset-0 rounded-full border-2 transition-all duration-1000 ease-out delay-150", isAiSpeaking ? "border-[#CCFF00]/30 scale-[1.5] opacity-0" : "border-slate-700/50 scale-100 opacity-20")} />
                                    <div className={cn("absolute inset-0 rounded-full border-2 transition-all duration-1000 ease-out delay-300", isAiSpeaking ? "border-[#CCFF00]/20 scale-[1.2] opacity-0" : "border-slate-700/50 scale-100 opacity-20")} />
                                </>
                            )}
                            
                            {/* Inner AI Core */}
                            <div className={cn(
                                "relative z-10 w-40 h-40 rounded-full flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                status === "connecting" && "animate-pulse",
                                isAiSpeaking 
                                    ? "bg-gradient-to-tr from-[#99cc00] to-[#e6ff66] shadow-[0_0_80px_rgba(204,255,0,0.4)] scale-110" 
                                    : "bg-gradient-to-tr from-slate-800 to-slate-700 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-600/50 scale-100 hover:scale-105"
                            )}>
                                {isCalling ? (
                                    <Activity className={cn(
                                        "w-14 h-14 transition-colors duration-500",
                                        isAiSpeaking ? "text-slate-900" : "text-white/40"
                                    )} />
                                ) : (
                                    <Mic className="w-14 h-14 text-white/50" />
                                )}
                            </div>
                        </div>

                        {/* Status Text under Orb */}
                        <div className="absolute bottom-[-10px] text-center w-full">
                            <h2 className="text-2xl font-semibold text-white tracking-wide mb-3 drop-shadow-md">
                                {status === "ready" || status === "ended" 
                                    ? "Demoyu Başlatın" 
                                    : status === "connecting" 
                                        ? "Bağlantı Kuruluyor..." 
                                        : (isAiSpeaking ? "Yapay Zeka Konuşuyor" : "Sizi Dinliyor...")}
                            </h2>
                            <p className="text-slate-400 text-sm max-w-[250px] mx-auto leading-relaxed">
                                {status === "ready" || status === "ended" 
                                    ? "Gerçek zamanlı gecikmesiz görüşme deneyimine hazırız." 
                                    : "Normal bir telefon görüşmesi yapar gibi konuşabilirsiniz."}
                            </p>
                        </div>
                    </div>

                    {/* Bottom Control Dock */}
                    <div className="relative z-10 bg-white/10 backdrop-blur-xl p-2.5 rounded-full border border-white/10 shadow-2xl flex items-center gap-3 w-max">
                        <button 
                            disabled={!isCalling}
                            className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                            title="Mikrofonu Kapat"
                        >
                            <MicOff className="w-5 h-5" />
                        </button>
                        
                        <button 
                            onClick={toggleCall}
                            className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95",
                                isCalling || status === "connecting" 
                                    ? "bg-red-500 shadow-red-500/40 hover:bg-red-600" 
                                    : "bg-[#CCFF00] text-slate-900 shadow-[#CCFF00]/20 hover:bg-[#b0df00] border-2 border-[#CCFF00]/50"
                            )}
                        >
                            {isCalling || status === "connecting" ? <PhoneOff className="w-7 h-7" /> : <PhoneOff className="w-7 h-7 rotate-[135deg]" />}
                        </button>

                        <button 
                            disabled={!isCalling}
                            className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                            title="Ayarlar"
                        >
                            <Activity className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: TRANSCRIPT LAYER ── */}
                <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden min-h-[500px] lg:min-h-[600px]">
                    
                    {/* Transcript Header */}
                    <div className="px-8 py-6 border-b border-slate-100/80 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <span className="font-semibold text-slate-800">Canlı Transkript</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_theme(colors.emerald.500)]" />
                             <span className="text-xs font-medium text-slate-500">Sistem Aktif</span>
                        </div>
                    </div>

                    {/* Transcript Body */}
                    <div className="flex-1 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50/50 to-white">
                        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
                            {messages.map((msg, idx) => {
                                const isAI = msg.speaker === "ai";
                                return (
                                    <div key={idx} className={cn("flex w-full animate-in fade-in slide-in-from-bottom-2", isAI ? "justify-start" : "justify-end")}>
                                        <div className={cn("flex flex-col max-w-[80%]", isAI ? "items-start" : "items-end")}>
                                            <span className="text-[11px] font-bold tracking-wider text-slate-400 mb-1.5 uppercase ml-1 mr-1">
                                                {isAI ? "LUERA AI" : "SİZ"}
                                            </span>
                                            <div className={cn(
                                                "relative px-6 py-4 text-[15px] shadow-sm",
                                                isAI 
                                                    ? "bg-white text-slate-700 border border-slate-100 rounded-3xl rounded-tl-sm leading-relaxed" 
                                                    : "bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl rounded-tr-sm leading-relaxed"
                                            )}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Typing Indicator */}
                            {isCalling && isAiSpeaking && (
                                <div className="flex justify-start w-full animate-in fade-in">
                                    <div className="flex flex-col items-start max-w-[80%]">
                                        <span className="text-[11px] font-bold tracking-wider text-[#CCFF00] mb-1.5 uppercase ml-1">
                                            LUERA AI YANIT VERİYOR...
                                        </span>
                                        <div className="bg-white px-6 py-5 rounded-3xl rounded-tl-sm border border-[#CCFF00]/30 shadow-sm flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <div className="w-2 h-2 rounded-full bg-[#CCFF00] animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transcript Footer Logs/Stats */}
                    <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                             <div className="flex items-center justify-center p-1.5 bg-emerald-100/50 rounded-md text-emerald-600 border border-emerald-100">
                                 <Activity className="w-3.5 h-3.5" />
                             </div>
                             <span>Gecikme (Latency): <span className="text-emerald-600 font-bold ml-1">~120ms</span></span> 
                        </div>
                        <div className="flex gap-4">
                            <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> ElevenLabs AI
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Global override for custom scrollbar in this specific page context if needed */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
};

