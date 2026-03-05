import { useState, useEffect, useRef } from "react";
import { PhoneOff, Pause, Play, MicOff, Waves } from "lucide-react";
import { cn } from "@/utils/cn";

// Simulated Live Transcript Data
const MOCK_TRANSCRIPT = [
    { id: 1, speaker: "ai", text: "Merhaba, Elif Hanım ile mi görüşüyorum?", time: "00:03" },
    { id: 2, speaker: "user", text: "Evet, benim. Buyurun?", time: "00:06" },
    { id: 3, speaker: "ai", text: "Ben kısaca LUERA, hedeflenen yeni kampanyamız hakkında bilgilendirmek için aradım. Şu an müsait misiniz?", time: "00:12" },
    { id: 4, speaker: "user", text: "Çok vaktim yok ama dinliyorum.", time: "00:15" },
    { id: 5, speaker: "ai", text: "Harika. Mevcut paketinizin süresi dolmak üzere. Eğer bugün yenilerseniz %20 indirim tanımlayabilirim.", time: "00:22" }
];

export const LiveCallsPage = () => {
    const [duration, setDuration] = useState(22);
    const [status, setStatus] = useState<"talking" | "hold" | "ended">("talking");
    const [messages, setMessages] = useState(MOCK_TRANSCRIPT.slice(0, 3));
    const [isAiSpeaking, setIsAiSpeaking] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Duration timer
    useEffect(() => {
        if (status === "ended") return;
        const id = setInterval(() => {
            setDuration(p => p + 1);
        }, 1000);
        return () => clearInterval(id);
    }, [status]);

    // Simulate Transcript Streaming
    useEffect(() => {
        if (status !== "talking") return;
        if (messages.length < MOCK_TRANSCRIPT.length) {
            const timer = setTimeout(() => {
                const nextMsg = MOCK_TRANSCRIPT[messages.length];
                setMessages(prev => [...prev, nextMsg]);
                setIsAiSpeaking(nextMsg.speaker === "ai");
            }, 4000);
            return () => clearTimeout(timer);
        } else {
            const aiToggleId = setInterval(() => {
                setIsAiSpeaking(prev => !prev);
            }, 3000);
            return () => clearInterval(aiToggleId);
        }
    }, [messages, status]);

    // Auto-scroll transcript
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
        <div className="h-[calc(100vh-80px)] xl:h-screen w-full bg-[#F4F7FB] text-slate-900 flex flex-col relative overflow-hidden font-sans">
            {/* Ambient Shadow Overlay for smooth integration with sidebar */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/[0.02] to-transparent pointer-events-none z-10" />

            {/* Ambient Background Glow */}
            <div
                className={cn(
                    "absolute top-1/2 left-[30%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none transition-all duration-[3s] ease-in-out",
                    isAiSpeaking && status === "talking" ? "bg-[#CCFF00]/50 scale-110" : "bg-white scale-90",
                    status === "ended" && "opacity-0"
                )}
            />

            <div className="w-full h-full max-w-[1600px] mx-auto flex flex-col lg:flex-row relative z-10 p-4 md:p-8 gap-8">

                {/* Visual / Orb Area (Left) */}
                <div className="flex-1 flex flex-col relative">
                    {/* Minimalist Header */}
                    <div className="flex justify-between items-start mb-auto">
                        <div>
                            <div className="flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className={cn("w-1.5 h-1.5 rounded-full", status === "talking" ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-amber-500")} />
                                <span className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase">Canlı Yayın</span>
                            </div>
                            <h1 className="text-4xl font-light tracking-tight text-slate-800 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">Elif Demir</h1>
                            <p className="text-green-600 font-mono mt-2 text-sm animate-in fade-in slide-in-from-left-4 duration-700 delay-200">+90 533 222 33 44</p>
                        </div>
                        <div className="text-right animate-in fade-in slide-in-from-right-4 duration-700">
                            <p className="text-4xl font-light tabular-nums tracking-tighter text-slate-700">
                                {formatTime(duration)}
                            </p>
                        </div>
                    </div>

                    {/* Premium Minimalist Orb */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center justify-center">
                        {status === "ended" ? (
                            <div className="text-center opacity-40 animate-in zoom-in duration-700">
                                <PhoneOff className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                                <p className="text-sm tracking-[0.2em] font-medium text-slate-500 uppercase">Çağrı Sonlandırıldı</p>
                            </div>
                        ) : (
                            <div className="relative w-72 h-72 flex items-center justify-center">
                                {/* Ripple 1 */}
                                <div className={cn(
                                    "absolute inset-0 rounded-full border border-green-500/30 transition-all duration-1000",
                                    isAiSpeaking && status === "talking" ? "scale-[1.5] opacity-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" : "scale-100 opacity-10"
                                )} />
                                {/* Ripple 2 */}
                                <div className={cn(
                                    "absolute inset-0 rounded-full border border-green-400/50 transition-all duration-700 delay-150",
                                    isAiSpeaking && status === "talking" ? "scale-[1.2] opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" : "scale-100 opacity-10"
                                )} />

                                {/* Core */}
                                <div className={cn(
                                    "relative z-10 w-40 h-40 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-700 ease-out",
                                    isAiSpeaking && status === "talking"
                                        ? "bg-white border-green-300 shadow-[0_0_80px_rgba(132,204,22,0.3)] scale-105"
                                        : "bg-white/80 border-slate-200 scale-100 shadow-xl"
                                )}>
                                    <Waves className={cn(
                                        "w-12 h-12 transition-all duration-700",
                                        isAiSpeaking && status === "talking" ? "text-green-500 opacity-100 scale-110" : "text-slate-300 opacity-80 scale-100"
                                    )} />
                                </div>
                            </div>
                        )}
                        {status !== "ended" && (
                            <div className="absolute -bottom-24 text-center w-full animate-in fade-in duration-1000">
                                <p className="text-[10px] tracking-[0.4em] font-bold text-slate-400 uppercase">
                                    {status === "hold" ? "Beklemede" : isAiSpeaking ? "LUERA Konuşuyor" : "Müşteri Dinleniyor"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Transcript Area (Right) - No Cards, Just Floating Text */}
                <div className="w-full lg:w-[450px] xl:w-[500px] h-full flex flex-col relative z-20 pb-24 lg:pb-0">
                    <div className="flex-1 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-8 px-4 opacity-70">
                            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500">Transkript</h3>
                            <span className="text-[10px] font-mono tracking-widest text-slate-400">ID: LR-94A2</span>
                        </div>

                        {/* Fading Mask for scroll */}
                        <div className="relative flex-1 overflow-hidden">
                            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#F4F7FB] to-transparent z-10 pointer-events-none" />

                            <div ref={scrollRef} className="h-full overflow-y-auto px-4 pb-12 pt-32 space-y-8 custom-scrollbar scroll-smooth">
                                {messages.map((msg) => {
                                    const isAI = msg.speaker === "ai";
                                    return (
                                        <div key={msg.id} className={cn(
                                            "flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out",
                                            isAI ? "items-start" : "items-end"
                                        )}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className={cn(
                                                    "text-[9px] tracking-[0.2em] uppercase font-bold",
                                                    isAI ? "text-green-600" : "text-slate-400"
                                                )}>
                                                    {isAI ? "LUERA" : "Müşteri"}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400">{msg.time}</span>
                                            </div>
                                            <div className={cn(
                                                "text-[15px] leading-relaxed tracking-wide font-medium",
                                                isAI ? "text-slate-800 pr-12" : "text-slate-500 pl-12 text-right"
                                            )}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Minimalism Typing Indicator */}
                                {status === "talking" && isAiSpeaking && (
                                    <div className="flex flex-col items-start animate-in fade-in duration-500 mt-6">
                                        <div className="flex gap-2 items-center opacity-60">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "0ms" }}></div>
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "200ms" }}></div>
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: "400ms" }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Glass Controls - Absolute Bottom Center */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="flex items-center gap-1 p-1.5 rounded-full bg-white/70 border border-slate-200/50 backdrop-blur-xl shadow-xl ring-1 ring-black/5">
                    <button
                        onClick={() => setStatus(s => s === "talking" ? "hold" : "talking")}
                        disabled={status === "ended"}
                        className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-30",
                            status === "hold" ? "bg-amber-100 text-amber-600 hover:bg-amber-200" : "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        )}
                        title={status === "hold" ? "Devam" : "Beklet"}
                    >
                        {status === "hold" ? <Play className="w-5 h-5 fill-current border-none" /> : <Pause className="w-5 h-5 fill-current border-none" />}
                    </button>

                    <button
                        disabled={status === "ended"}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all duration-300 disabled:opacity-30"
                        title="Araya Gir / Mikrofon"
                    >
                        <MicOff className="w-5 h-5" />
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-3"></div>

                    <button
                        onClick={() => setStatus("ended")}
                        disabled={status === "ended"}
                        className="w-14 h-14 rounded-full flex items-center justify-center bg-transparent text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-300 disabled:opacity-30"
                        title="Çağrıyı Sonlandır"
                    >
                        <PhoneOff className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 4px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                }
            `}</style>
        </div>
    );
};
