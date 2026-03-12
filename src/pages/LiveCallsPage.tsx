import { useState, useEffect, useRef } from "react";
import { PhoneOff, Play, MicOff, Bot, ChevronDown, Activity, Lock, Signal } from "lucide-react";
import { cn } from "@/utils/cn";

interface Message {
    id: number;
    speaker: "ai" | "user";
    text: string;
    time: string;
}

const AVAILABLE_AGENTS = [
    { id: "demo_elif_demir", name: "Elif Demir (Demo Görüşmesi)" }
];

export const LiveCallsPage = () => {
    // Basic States
    const [duration, setDuration] = useState(0);
    const [status, setStatus] = useState<"ready" | "connecting" | "talking" | "hold" | "ended">("ready");
    
    // Retell States
    const [isCalling, setIsCalling] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string>(AVAILABLE_AGENTS[0]?.id || "");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);

    // Demo Timeout Refs
    const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

    const clearDemoTimeouts = () => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
    };

    const runDemoScript = () => {
        const scheduleEvent = (delay: number, action: () => void) => {
            const id = setTimeout(action, delay);
            timeoutsRef.current.push(id);
        };

        // 0s: Start connecting
        scheduleEvent(0, () => {
            setStatus("connecting");
            setMessages([]);
        });

        // 2s: Call connected
        scheduleEvent(2000, () => {
            setStatus("talking");
            setIsCalling(true);
            setDuration(0);
        });

        // 3s: AI Starts speaking
        scheduleEvent(3000, () => setIsAiSpeaking(true));

        // 7s: AI Finishes first line
        scheduleEvent(7000, () => {
            setIsAiSpeaking(false);
            setMessages(prev => [...prev, { id: 1, speaker: "ai", text: "Merhaba Elif Hanım, ben LUNA. İlettiğiniz destek talebine istinaden arıyorum. Müsait miydiniz?", time: "00:07" }]);
        });

        // 8s: User (Elif) answers
        scheduleEvent(8500, () => {
            setMessages(prev => [...prev, { id: 2, speaker: "user", text: "Evet merhabalar, dinliyorum.", time: "00:08" }]);
        });

        // 10s: AI starts reply
        scheduleEvent(10000, () => setIsAiSpeaking(true));

        // 16s: AI finishes reply
        scheduleEvent(16000, () => {
            setIsAiSpeaking(false);
            setMessages(prev => [...prev, { id: 3, speaker: "ai", text: "Sistemimizde faturanızla ilgili yaşadığınız aksaklığı inceliyordum. Mükerrer çekim tespit ettik ve iadenizi az önce bankanıza yansıtılmak üzere onayladık.", time: "00:16" }]);
        });

        // 18s: User answers
        scheduleEvent(18000, () => {
             setMessages(prev => [...prev, { id: 4, speaker: "user", text: "Ah çok teşekkür ederim, gerçekten hızlı oldu. Ne zaman hesabıma geçer peki?", time: "00:18" }]);
        });

        // 20s: AI starts reply
        scheduleEvent(20000, () => setIsAiSpeaking(true));

        // 25s: AI Finishes reply
        scheduleEvent(25000, () => {
            setIsAiSpeaking(false);
            setMessages(prev => [...prev, { id: 5, speaker: "ai", text: "Bankanızın işlem yoğunluğuna bağlı olarak genellikle 1 ila 3 iş günü içinde hesabınızda olacaktır. Size süreçle ilgili bir bilgilendirme SMS'i de gönderiyorum. Başka yardımcı olabileceğim bir konu var mıydı?", time: "00:25" }]);
        });

        // 28s: User
        scheduleEvent(28000, () => {
             setMessages(prev => [...prev, { id: 6, speaker: "user", text: "Hayır başka bir şey yok, iyi çalışmalar.", time: "00:28" }]);
        });

        // 29s: AI
        scheduleEvent(29500, () => setIsAiSpeaking(true));
        scheduleEvent(32000, () => {
            setIsAiSpeaking(false);
            setMessages(prev => [...prev, { id: 7, speaker: "ai", text: "Teşekkür eder, iyi günler dilerim. Hoşça kalın.", time: "00:32" }]);
        });

        // 34s: Hang up
        scheduleEvent(34000, () => {
            setStatus("ended");
            setIsCalling(false);
        });
    };

    // Automatically start the demo when the page loads
    useEffect(() => {
        // Wait a tiny bit for the UI to settle before connecting
        const initialDelay = setTimeout(() => {
            if (status === "ready" && !isCalling) {
                runDemoScript();
            }
        }, 500);

        return () => {
            clearTimeout(initialDelay);
            clearDemoTimeouts();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Toggle Call Logic
    const toggleCall = () => {
        if (isCalling || status === "connecting") {
            clearDemoTimeouts();
            setStatus("ended");
            setIsCalling(false);
            setIsAiSpeaking(false);
        } else {
            clearDemoTimeouts();
            setIsDropdownOpen(false);
            runDemoScript();
        }
    };


    // Duration timer
    useEffect(() => {
        if (status !== "talking") return;
        const id = setInterval(() => {
            setDuration(p => p + 1);
        }, 1000);
        return () => clearInterval(id);
    }, [status]);

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

    const currentAgentName = AVAILABLE_AGENTS.find(a => a.id === selectedAgentId)?.name || "Asistan Seç";

    return (
        // Enforce strict 100vh on the root
        <div className="h-screen w-full bg-[#FAFAFC] text-slate-800 flex flex-col relative overflow-hidden font-sans">
            {/* Vanguard Ambient Aurora Effect (Light Mode) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className={cn(
                        "absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[140px] mix-blend-multiply transition-all duration-[4s] ease-in-out",
                        isAiSpeaking && status === "talking" ? "bg-emerald-200/40 scale-125" : "bg-emerald-100/30 scale-100",
                        (status === "ended" || status === "ready") && "opacity-30"
                    )}
                />
                 <div
                    className={cn(
                        "absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[150px] mix-blend-multiply transition-all duration-[5s] ease-in-out delay-700",
                        isAiSpeaking && status === "talking" ? "bg-cyan-200/30 scale-110" : "bg-blue-100/30 scale-90",
                        (status === "ended" || status === "ready") && "opacity-20"
                    )}
                />
            </div>

            {/* Premium Header / Status Bar (Light Mode) */}
            <div className="w-full px-6 py-4 flex items-center justify-between relative z-20 border-b border-black/5 bg-white/40 backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", status === "talking" ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse" : "bg-emerald-500/30")} />
                        <span className="text-[11px] font-bold tracking-[0.3em] text-slate-500 uppercase">Interactive AI Channel</span>
                    </div>
                    {/* Admin Tech Details */}
                    <div className="hidden md:flex items-center gap-4 text-[10px] font-mono tracking-widest text-slate-400">
                        <div className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> SYS_LOAD: 12%</div>
                        <div className="flex items-center gap-1.5"><Signal className="w-3 h-3" /> LATENCY: 24ms</div>
                        <div className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-emerald-500" /> SECURE_E2E</div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                     {/* Agent Selector Dropdown (Light Mode) */}
                     <div className="relative">
                        <button 
                            onClick={() => !isCalling && setIsDropdownOpen(!isDropdownOpen)}
                            disabled={isCalling || status === "connecting"}
                            className="flex items-center gap-2 px-4 py-2 bg-white/60 border border-slate-200/60 rounded-lg shadow-sm backdrop-blur-md hover:bg-white/80 transition-all text-xs font-medium text-slate-600 disabled:opacity-50"
                        >
                            {currentAgentName}
                            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isDropdownOpen && "rotate-180")} />
                        </button>
                        
                        {isDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                {AVAILABLE_AGENTS.map((agent) => (
                                    <button
                                        key={agent.id}
                                        onClick={() => {
                                            setSelectedAgentId(agent.id);
                                            setIsDropdownOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-4 py-3 text-sm transition-colors hover:bg-slate-50 border-b border-slate-50 last:border-0",
                                            selectedAgentId === agent.id ? "bg-emerald-50 text-emerald-600 font-medium" : "text-slate-600"
                                        )}
                                    >
                                        <div className="font-semibold">{agent.name}</div>
                                        <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">{agent.id}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Added min-h-0 to flex children to prevent them from growing beyond container height */}
            <div className="w-full flex-1 min-h-0 max-w-[1600px] mx-auto flex flex-col lg:flex-row relative z-10 pt-4 lg:pt-0 gap-6 lg:gap-8 pb-20">

                {/* Visual / Orb Area (Left) */}
                <div className="flex-1 min-h-0 flex flex-col relative justify-center items-center">
                    
                    {/* Centered Timer */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center animate-in fade-in slide-in-from-top-4 duration-700">
                        <p className={cn(
                            "text-5xl lg:text-6xl font-light tabular-nums tracking-tighter transition-colors duration-500",
                            status === "talking" ? "text-slate-800 drop-shadow-[0_0_20px_rgba(0,0,0,0.05)]" : "text-slate-400"
                        )}>
                            {formatTime(duration)}
                        </p>
                    </div>

                    {/* Premium Minimalist Orb */}
                    <div className="mt-4 flex flex-col items-center justify-center">
                        {status === "ended" ? (
                            <div className="text-center opacity-60 animate-in zoom-in duration-700 cursor-pointer" onClick={toggleCall}>
                                <div className="w-24 h-24 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-6 shadow-sm hover:bg-emerald-50/50 hover:border-emerald-200 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:scale-105 transition-all duration-500 cursor-pointer group">
                                    <Play className="w-10 h-10 text-emerald-500 ml-1 opacity-80 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <p className="text-xs tracking-[0.3em] font-bold text-slate-400 uppercase">Çağrı Sonlandırıldı</p>
                                <p className="text-[10px] tracking-wider text-slate-400 mt-2 uppercase">Tekrar Oynat</p>
                            </div>
                        ) : status === "ready" ? (
                            // Completely hidden or transparent while waiting for the auto-start tick
                            <div className="opacity-0 w-24 h-24" />
                        ) : (
                            <div className="relative w-80 h-80 flex items-center justify-center">
                                {/* Base Halo */}
                                <div className="absolute inset-4 rounded-full bg-white/40 backdrop-blur-md border border-slate-200/50 shadow-[0_20px_40px_rgba(0,0,0,0.02)]" />
                                
                                {/* Inner Pulse 1 */}
                                <div className={cn(
                                    "absolute inset-0 rounded-full border transition-all duration-1000",
                                    isAiSpeaking && status === "talking" ? "border-emerald-500/30 scale-[1.3] opacity-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" : "border-slate-300/30 scale-100 opacity-20"
                                )} />
                                {/* Inner Pulse 2 */}
                                <div className={cn(
                                    "absolute inset-4 rounded-full border transition-all duration-700 delay-150",
                                    isAiSpeaking && status === "talking" ? "border-emerald-400/50 scale-[1.15] opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" : "border-slate-300/50 scale-100 opacity-40"
                                )} />

                                {/* Core Crystal Center */}
                                <div className={cn(
                                    "relative z-10 w-44 h-44 rounded-full flex items-center justify-center backdrop-blur-2xl border transition-all duration-700 ease-out",
                                    status === "connecting" && "animate-pulse bg-slate-50 border-slate-200",
                                    isAiSpeaking && status === "talking"
                                        ? "bg-white border-emerald-300 shadow-[0_0_80px_rgba(16,185,129,0.15)] shadow-inner scale-105"
                                        : "bg-white border-slate-200/80 scale-100 shadow-2xl"
                                )}>
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-t from-emerald-500/5 to-transparent opacity-50 pointer-events-none" />
                                    <Bot className={cn(
                                        "w-24 h-24 transition-all duration-700 relative z-20",
                                        isAiSpeaking && status === "talking" ? "text-emerald-500 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)] opacity-100 scale-110" : "text-slate-300 opacity-80 scale-100"
                                    )} />
                                </div>
                            </div>
                        )}
                        {status !== "ended" && status !== "ready" && (
                            <div className="absolute -bottom-16 text-center w-full animate-in fade-in duration-1000">
                                <p className="text-[10px] tracking-[0.5em] font-bold text-slate-400 uppercase">
                                    {status === "connecting" ? "Bağlantı Kuruluyor..." : isAiSpeaking ? "LUNA AKTİF" : "Müşteri Dinleniyor"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vertical Divider line */}
                <div className="hidden lg:block w-px h-[60%] my-auto bg-gradient-to-b from-transparent via-black/5 to-transparent"></div>

                {/* Transcript Area (Right) - No Cards, Just Floating Text */}
                <div className="w-full lg:w-[450px] xl:w-[500px] flex-1 min-h-0 flex flex-col relative z-20">
                    <div className="flex-1 min-h-0 flex flex-col justify-end">
                        <div className="flex items-center justify-between mb-4 px-4 opacity-70 shrink-0">
                            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-emerald-600">Transkript Akışı</h3>
                            <span className="text-[10px] font-mono tracking-widest text-slate-400">SESSION_ID: {selectedAgentId?.slice(-6).toUpperCase()}</span>
                        </div>

                        {/* Fading Mask for scroll */}
                        <div className="relative flex-1 overflow-hidden" style={{ maskImage: "linear-gradient(to bottom, transparent, black 10%, black)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 10%, black)" }}>
                            <div ref={scrollRef} className="h-full overflow-y-auto px-4 pb-12 pt-10 space-y-8 custom-scrollbar scroll-smooth">
                                {/* Removed the empty placeholder so it's clean until the AI speaks */}
                                {messages.map((msg) => {
                                    const isAI = msg.speaker === "ai";
                                    return (
                                        <div key={msg.id} className={cn(
                                            "flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out",
                                            isAI ? "items-start" : "items-end"
                                        )}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <span className={cn(
                                                    "text-[10px] tracking-[0.3em] uppercase font-bold",
                                                    isAI ? "text-emerald-600" : "text-slate-400"
                                                )}>
                                                    {isAI ? "LUNA" : "ELİF DEMİR"}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400">{msg.time}</span>
                                            </div>
                                            <div className={cn(
                                                "text-[16px] leading-relaxed tracking-wide font-medium",
                                                isAI ? "text-slate-800 pr-12 drop-shadow-sm" : "text-slate-500 pl-12 text-right"
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
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: "0ms" }}></div>
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: "200ms" }}></div>
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: "400ms" }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Floating Premium Glass Controls - Absolute Bottom Center */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="flex items-center gap-3 p-2 rounded-[2.5rem] bg-white/70 border border-white backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                     <button
                        onClick={toggleCall}
                        className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border relative group overflow-hidden shadow-sm",
                            isCalling || status === "connecting"
                                ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.15)]" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                        )}
                        title={isCalling ? "Çağrıyı Kapat" : "Çağrıyı Başlat"}
                    >
                        {isCalling || status === "connecting" ? <PhoneOff className="w-6 h-6 relative z-10" /> : <Play className="w-6 h-6 ml-1 relative z-10" />}
                    </button>
                    
                    <div className="w-px h-8 bg-black/5 mx-1"></div>

                    <button
                        disabled={!isCalling}
                        className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-50/50 text-slate-400 border border-transparent hover:bg-white hover:text-slate-800 hover:border-slate-200 transition-all duration-300 disabled:opacity-30 disabled:hover:bg-slate-50/50 disabled:hover:border-transparent"
                        title="Araya Gir / Sessiz"
                    >
                        <MicOff className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Premium Scrollbar Styles */}
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
                    background: rgba(16, 185, 129, 0.2);
                }
            `}</style>
        </div>
    );
};
