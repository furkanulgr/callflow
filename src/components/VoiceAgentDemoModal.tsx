import { useState, useRef, useEffect, useCallback } from "react";
import { X, Mic, MicOff, PhoneOff, Sparkles, Clock } from "lucide-react";
import { cn } from "@/utils/cn";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { startElevenLabsConversation } from "@/utils/elevenlabs";

interface TranscriptItem {
    role: "ai" | "user";
    text: string;
}

interface VoiceAgentDemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaignName: string;
    agentId?: string;
    agentRole?: string;
}

export const VoiceAgentDemoModal = ({ isOpen, onClose, campaignName, agentId, agentRole }: VoiceAgentDemoModalProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [agentState, setAgentState] = useState<AgentState>("ready");
    const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);

    const conversationRef = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fmt = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, "0");
        return `${m}:${(s % 60).toString().padStart(2, "0")}`;
    };

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [transcript]);

    useEffect(() => {
        if (isConnected) {
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isConnected]);

    const startDemo = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        setTranscript([]);
        setAgentState("connecting");
        try {
            const conv = await startElevenLabsConversation({
                onConnect: () => { setIsConnected(true); setIsConnecting(false); setAgentState("listening"); },
                onDisconnect: () => { setIsConnected(false); setIsConnecting(false); setAgentState("ended"); },
                onError: (err) => { setError(err); setIsConnecting(false); setAgentState("ended"); },
                onModeChange: ({ mode }) => { setAgentState(mode === "speaking" ? "speaking" : "listening"); },
                onMessage: ({ message, source }) => {
                    if (message.trim()) setTranscript(prev => [...prev, { role: source, text: message }]);
                }
            }, agentId);
            conversationRef.current = conv;
        } catch { setIsConnecting(false); setAgentState("ended"); }
    }, [agentId]);

    const stopDemo = useCallback(async () => {
        try { if (conversationRef.current) { await conversationRef.current.endSession(); conversationRef.current = null; } } catch {}
        setIsConnected(false); setIsConnecting(false); setAgentState("ended");
    }, []);

    const handleClose = () => {
        if (isConnected || isConnecting) stopDemo();
        setTranscript([]); setError(null); setElapsed(0); setAgentState("ready");
        onClose();
    };

    if (!isOpen) return null;

    const stateLabel = agentState === "speaking" ? "LUNA Konuşuyor"
        : agentState === "listening" ? "Dinliyor"
            : agentState === "thinking" ? "Düşünüyor" : "Bekliyor";

    const stateColor = agentState === "speaking" ? "text-[#CCFF00]"
        : agentState === "listening" ? "text-emerald-400"
            : agentState === "thinking" ? "text-amber-400" : "text-slate-500";

    return (
        <>
            {/* Backdrop — hafif, tıklanabilir */}
            <div className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-[2px]" onClick={handleClose} />

            {/* Kompakt Popup */}
            <div className="fixed z-[200] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-[#0C1017] rounded-2xl shadow-2xl shadow-black/50 border border-slate-800/60 overflow-hidden">

                    {/* Header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800/50">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                isConnected ? "bg-[#CCFF00] shadow-[0_0_6px_#CCFF00] animate-pulse"
                                    : isConnecting ? "bg-amber-400 animate-pulse" : "bg-slate-600"
                            )} />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                                    {agentRole || "Sesli Demo"}
                                </p>
                                <p className="text-sm font-bold text-white truncate">{campaignName}</p>
                            </div>
                        </div>
                        <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-all flex-shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Visualizer + Controls */}
                    <div className="px-5 py-4">

                        {/* BarVisualizer — kompakt */}
                        <div className="h-[60px] mb-4 flex items-center justify-center">
                            <BarVisualizer state={agentState} barCount={20} minHeight={10} maxHeight={95} className="w-full h-full" />
                        </div>

                        {/* Timer + State (sadece bağlıyken) */}
                        {isConnected && (
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <span className="text-lg font-mono font-bold text-white tracking-wider">{fmt(elapsed)}</span>
                                <span className="text-[1px] text-slate-700">•</span>
                                <span className={cn("text-[11px] font-bold uppercase tracking-wider", stateColor)}>{stateLabel}</span>
                            </div>
                        )}

                        {/* Start Button */}
                        {!isConnected && !isConnecting && (
                            <button
                                onClick={startDemo}
                                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-[#CCFF00] text-slate-900 font-bold text-sm hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] active:scale-[0.98] transition-all"
                            >
                                <Mic className="w-4 h-4" />
                                Sesli Demo Başlat
                            </button>
                        )}

                        {/* Connecting */}
                        {isConnecting && (
                            <div className="flex items-center justify-center gap-2 py-3">
                                <div className="w-4 h-4 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-bold text-slate-400">Bağlanıyor...</span>
                            </div>
                        )}

                        {/* Connected Controls */}
                        {isConnected && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all",
                                        isMuted
                                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                                            : "bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-white"
                                    )}
                                >
                                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                    {isMuted ? "Sessiz" : "Mikrofon"}
                                </button>
                                <button
                                    onClick={stopDemo}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
                                >
                                    <PhoneOff className="w-3.5 h-3.5" />
                                    Bitir
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Transcript — sadece mesaj varsa göster */}
                    {transcript.length > 0 && (
                        <div className="border-t border-slate-800/50">
                            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-[#CCFF00]" />
                                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">Transkript</span>
                            </div>
                            <div ref={scrollRef} className="max-h-[140px] overflow-y-auto px-4 pb-4 custom-scrollbar space-y-2">
                                {transcript.map((item, i) => (
                                    <div key={i} className={cn("flex gap-2", item.role === "user" && "flex-row-reverse")}>
                                        <div className={cn(
                                            "w-5 h-5 rounded-md flex items-center justify-center text-[7px] font-black flex-shrink-0 mt-0.5",
                                            item.role === "ai" ? "bg-[#CCFF00]/10 text-[#CCFF00]" : "bg-slate-800 text-slate-500"
                                        )}>
                                            {item.role === "ai" ? "AI" : "🎤"}
                                        </div>
                                        <div className={cn(
                                            "px-3 py-2 rounded-xl text-[12px] leading-relaxed max-w-[85%]",
                                            item.role === "ai"
                                                ? "bg-slate-800/70 text-slate-300 rounded-tl-sm"
                                                : "bg-[#CCFF00]/8 border border-[#CCFF00]/15 text-slate-300 rounded-tr-sm"
                                        )}>
                                            {item.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
