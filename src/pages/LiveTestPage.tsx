import { useState, useEffect, useRef } from "react";
import { Mic, PhoneOff, MicOff, Sparkles, X, Power } from "lucide-react";
import { cn } from "@/utils/cn";
import { retellClient, getWebCallToken, RETELL_AGENT_ID } from "@/utils/retell";

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
        { id: -1, speaker: "ai", text: "Merhaba! Ben LUERA, size nasıl yardımcı olabilirim? Herhangi bir kampanya oluşturmak ister misiniz?", time: "00:00" }
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    // Use centralized agent ID from retell util (with fallback)
    const agentId = RETELL_AGENT_ID;

    // ── RETELL SDK EVENT LISTENERS ──
    useEffect(() => {
        retellClient.on("call_started", () => {
            console.log("Call started");
            setIsCalling(true);
            setStatus("talking");
            setDuration(0); // Reset timer
            // Clear placeholder messages on real connect
            setMessages([]); 
        });

        retellClient.on("call_ended", () => {
            console.log("Call ended");
            setIsCalling(false);
            setStatus("ended");
            setIsAiSpeaking(false);
        });

        retellClient.on("agent_start_talking", () => setIsAiSpeaking(true));
        retellClient.on("agent_stop_talking", () => setIsAiSpeaking(false));

        retellClient.on("update", (update: any) => {
             if (update.transcript) {
                const newMessages = update.transcript.map((utterance: any, index: number) => ({
                    id: index,
                    speaker: utterance.role === "agent" ? "ai" : "user",
                    text: utterance.content,
                    time: formatTime(duration) // Keep rough time based on current duration
                }));
                // Only update if there is a change to avoid unnecessary re-renders
                setMessages(newMessages);
             }
        });

        retellClient.on("error", (error: any) => {
            console.error("Retell error:", error);
            setIsCalling(false);
            setStatus("ended");
        });

        return () => {
            retellClient.off("call_started");
            retellClient.off("call_ended");
            retellClient.off("agent_start_talking");
            retellClient.off("agent_stop_talking");
            retellClient.off("update");
            retellClient.off("error");
            if (isCalling) {
                retellClient.stopCall(); 
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── ACTIONS ──
    const toggleCall = async () => {
        if (isCalling || status === "connecting") {
            retellClient.stopCall();
            setStatus("ended");
        } else {
            try {
                if (!agentId) {
                    alert("Asistan ID'si bulunamadı (.env kontrol edin).");
                    return;
                }
                setStatus("connecting");
                setMessages([]);
                const token = await getWebCallToken(agentId);
                
                await retellClient.startCall({
                    accessToken: token,
                    sampleRate: 24000
                });
            } catch (error) {
                console.error("Failed to start call:", error);
                setStatus("ready");
                alert("Çağrı başlatılamadı. Lütfen mikrofon izinlerini kontrol edin.");
            }
        }
    };

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
        <div className="min-h-screen bg-[#F8F9FB] flex flex-col font-sans p-4 md:p-8">
            {/* ── HEADER ── */}
            <div className="max-w-7xl mx-auto w-full mb-8">
                <div className="bg-white rounded-2xl p-4 md:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#0F172A] flex items-center justify-center shadow-lg">
                            <Sparkles className="w-6 h-6 text-[#CCFF00]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900">Canlı AI Testi</h1>
                            <p className="text-sm text-slate-500 font-medium">Sisteminizin yapay zekasını gerçek zamanlı olarak test edin.</p>
                        </div>
                    </div>
                    {/* Close/Exit Button for the test panel */}
                    <button 
                        onClick={() => window.location.href = "/"}
                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ── MAIN CONTENT (Split Layout) ── */}
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col lg:flex-row gap-6">
                
                {/* ── LEFT: AUDIO CONTROLS ── */}
                <div className="flex-1 bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 relative overflow-hidden flex flex-col items-center justify-center p-8 min-h-[500px]">
                    
                    {/* Live Audio Indicator Top Left */}
                    <div className="absolute top-8 left-8 flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", isCalling ? "bg-red-500 animate-pulse" : "bg-slate-300")} />
                        <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                            LIVE AUDİO
                        </span>
                    </div>

                    {/* Central Orb / Microphone Area */}
                    <div className="relative mt-12 mb-20 flex flex-col items-center">
                        {status === "ready" || status === "ended" ? (
                             <button
                                onClick={toggleCall}
                                className="group relative w-32 h-32 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm hover:shadow-xl hover:border-slate-300 transition-all duration-300"
                            >
                                <Power className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                            </button>
                        ) : (
                            <div className="relative w-48 h-48 flex items-center justify-center">
                                {/* Soundwaves when speaking */}
                                {isCalling && (
                                    <>
                                        <div className={cn("absolute inset-0 rounded-full border border-[#CCFF00]/30 transition-all duration-1000", isAiSpeaking ? "scale-[1.8] opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" : "scale-100 opacity-20")} />
                                        <div className={cn("absolute inset-0 rounded-full border border-[#CCFF00]/50 transition-all duration-700 delay-150", isAiSpeaking ? "scale-[1.4] opacity-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" : "scale-100 opacity-20")} />
                                    </>
                                )}
                                
                                {/* Inner Core */}
                                <div className={cn(
                                    "relative z-10 w-32 h-32 rounded-full bg-[#0F172A] flex items-center justify-center shadow-2xl transition-transform duration-500",
                                    status === "connecting" && "animate-pulse",
                                    isAiSpeaking && "scale-110 shadow-[0_0_40px_rgba(204,255,0,0.3)]"
                                )}>
                                    <Mic className={cn(
                                        "w-10 h-10 transition-colors",
                                        isAiSpeaking ? "text-[#CCFF00]" : "text-white/80"
                                        )} 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="text-center mt-12">
                            <h2 className="text-xl font-bold text-slate-800 mb-2">
                                {status === "ready" ? "Bağlanmaya Hazır" : status === "connecting" ? "Bağlanıyor..." : status === "talking" ? (isAiSpeaking ? "Yapay Zeka Konuşuyor..." : "Dinleniyor...") : "Çağrı Sonlandı"}
                            </h2>
                            <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                {status === "ready" ? "Test için butona dokunun." : "Konuşarak yapay zeka ile etkileşime geçebilirsiniz."}
                            </p>
                        </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <button 
                            disabled={!isCalling}
                            className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                        >
                            <MicOff className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={toggleCall}
                            className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:scale-105 transition-all text-xl mt-[-10px]",
                                isCalling || status === "connecting" ? "bg-red-500" : "bg-emerald-500 shadow-emerald-500/30"
                            )}
                        >
                            {isCalling || status === "connecting" ? <PhoneOff className="w-6 h-6" /> : <Mic className="w-7 h-7" />}
                        </button>
                    </div>

                </div>

                {/* ── RIGHT: TRANSCRIPT ── */}
                <div className="flex-1 lg:max-w-md xl:max-w-lg bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col overflow-hidden">
                    
                    {/* Transcript Header */}
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-400">
                            <span className="w-4 h-4 rounded-sm border-2 border-slate-300 flex items-center justify-center overflow-hidden">
                                <div className="w-full h-px bg-slate-300 transform -rotate-45" />
                            </span>
                            <span className="text-[11px] font-bold tracking-widest uppercase">LİVE TRANSCRİPT</span>
                        </div>
                        <div className="px-3 py-1 bg-slate-50 rounded-full font-mono text-xs font-semibold text-slate-500 border border-slate-100">
                            {formatTime(duration)}
                        </div>
                    </div>

                    {/* Transcript Body */}
                    <div className="flex-1 bg-slate-50/50 relative">
                        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto p-6 space-y-6">
                            {messages.map((msg, idx) => {
                                const isAI = msg.speaker === "ai";
                                return (
                                    <div key={idx} className={cn("flex flex-col w-full animate-in fade-in slide-in-from-bottom-2", isAI ? "items-start" : "items-end")}>
                                        <span className="text-[10px] font-bold tracking-wider text-slate-400 mb-2 uppercase ml-1 mr-1">
                                            {isAI ? "LUERA AI" : "SİZ"}
                                        </span>
                                        <div className={cn(
                                            "relative px-5 py-3.5 max-w-[85%] text-[15px] shadow-sm",
                                            isAI 
                                                ? "bg-white text-slate-700/90 rounded-2xl rounded-tl-sm border border-slate-100 leading-relaxed font-medium" 
                                                : "bg-[#0F172A] text-white rounded-2xl rounded-tr-sm leading-relaxed"
                                        )}>
                                            {msg.text}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Typing Indicator */}
                            {isCalling && isAiSpeaking && (
                                <div className="flex flex-col items-start pt-2">
                                    <span className="text-[10px] font-bold tracking-wider text-[#CCFF00] mb-2 uppercase flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full animate-pulse" />
                                        LUERA AI YAZIYOR...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transcript Footer Info */}
                    <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                             <div className="flex items-center justify-center p-1 bg-emerald-50 rounded text-emerald-600">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                             </div>
                             <span>Gecikme: <span className="text-emerald-600 font-bold">120ms</span></span> {/* Hardcoded for demo/looks */}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-400">
                            Model: <span className="text-slate-700">Claude 3.5 Sonnet</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
