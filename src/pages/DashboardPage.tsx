import { useEffect, useState, useRef } from "react";
import {
    Phone, PhoneMissed, ArrowDownLeft, ArrowUpRight,
    Mic, MicOff, Headphones, Sparkles, Target,
    BarChart3, TrendingUp, ChevronRight, Circle,
    Radio, CheckCircle2, CalendarCheck, Users,
    Zap, Coffee, Lightbulb, Clock, Shield,
    X, Play, Pause, Volume2, MessageSquare, Bot, User,
    Flame, Snowflake, RefreshCw, Power, PhoneOff, Loader2
} from "lucide-react";
import { cn, formatDuration, getTimeAgo } from "@/utils/cn";
import { getConversations, getConversationDetails, getConversationAudio } from "@/services/elevenlabsApi";

/* ───── TYPES ───── */
type CallTag = "hot" | "warm" | "cold";
type CallType = "incoming" | "outgoing";
type CallStatus = "answered" | "missed";

interface CallRecord {
    id: string;
    name: string;
    phone: string;
    type: CallType;
    status: CallStatus;
    tag: CallTag;
    duration: number;
    time: Date;
    summary: string;
    conversationId?: string;
}

interface QueueItem {
    id: number;
    name: string;
    phone: string;
    scheduledFor: Date;
    reason: string;
}

/* ───── SKELETON ───── */
const SkeletonCallRow = () => (
    <div className="flex items-center gap-5 p-5 bg-white border border-gray-100 rounded-2xl animate-pulse">
        <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-gray-100 rounded-lg w-48" />
            <div className="h-3 bg-gray-100 rounded-lg w-32" />
        </div>
        <div className="hidden md:block h-6 w-16 bg-gray-100 rounded-lg" />
        <div className="hidden lg:block h-12 w-64 bg-gray-100 rounded-xl" />
        <div className="hidden md:block h-8 w-20 bg-gray-100 rounded-lg" />
    </div>
);

/* ───── MAP ElevenLabs conversation → CallRecord ───── */
const mapConversation = (conv: any): CallRecord => ({
    id: conv.conversation_id,
    conversationId: conv.conversation_id,
    name: conv.call_summary_title || conv.metadata?.phone_number || conv.metadata?.caller_id || "Bilinmeyen Numara",
    phone: conv.metadata?.phone_number || conv.metadata?.to_number || "–",
    type: conv.direction === "inbound" ? "incoming" : "outgoing",
    status: conv.call_successful === "failure" || conv.status === "failed" ? "missed" : "answered",
    tag: "cold",
    duration: conv.call_duration_secs ?? 0,
    time: new Date((conv.start_time_unix_secs ?? Date.now() / 1000) * 1000),
    summary: conv.transcript_summary || conv.analysis?.transcript_summary || conv.metadata?.summary || "Özet henüz oluşturulmadı.",
});

/* ───── SUB-COMPONENTS ───── */
const Waveform = ({ active }: { active: boolean }) => (
    <div className="flex items-center gap-[3px] h-10">
        {Array.from({ length: 18 }).map((_, i) => (
            <div key={i}
                className={cn("w-[3px] rounded-full wave-bar", active ? "wave-bar-active" : "")}
                style={{
                    background: active ? "#CCFF00" : "rgba(255,255,255,0.2)",
                    animationDelay: `${(i * 60) % 900}ms`,
                    minHeight: "4px", maxHeight: "100%",
                    height: active ? undefined : `${10 + Math.sin(i * 0.9) * 8}%`,
                }}
            />
        ))}
    </div>
);

const CallTypeIcon = ({ type, status }: { type: string; status: string }) => {
    if (status === "missed")
        return <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center"><PhoneMissed className="w-4 h-4 text-red-500" /></div>;
    if (type === "incoming")
        return <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /></div>;
    return <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-lime-700" /></div>;
};

const TagBadge = ({ tag }: { tag: "hot" | "warm" | "cold" }) => {
    if (tag === "hot") return <span className="badge-hot"><Flame className="w-3 h-3" /> Sıcak</span>;
    if (tag === "warm") return <span className="badge-warm"><RefreshCw className="w-3 h-3" /> Ilık</span>;
    return <span className="badge-cold"><Snowflake className="w-3 h-3" /> Soğuk</span>;
};

/* ───── CAROUSEL CARD (exactly like LeadFlow) ───── */
const CarouselCard = ({ slides, interval = 6000 }: { slides: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode }[]; interval?: number }) => {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setIdx(p => p + 1), interval);
        return () => clearInterval(t);
    }, [interval]);
    const slide = slides[idx % slides.length];
    return (
        <div className="flex-1 min-w-0 group relative rounded-2xl p-5 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            {/* Slide dots */}
            <div className="absolute top-2.5 right-5 flex gap-1">
                {slides.map((_, i) => (
                    <div key={i} className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        i === idx % slides.length ? "bg-slate-900 w-3" : "bg-gray-300"
                    )} />
                ))}
            </div>
            <div className="relative h-[88px]">
                <div key={idx} className="absolute inset-0 animate-slideUp">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">{slide.label}</p>
                        <div className="p-2.5 rounded-xl bg-slate-900">{slide.icon}</div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 tracking-tight whitespace-nowrap">{slide.value}</h3>
                    <div className="mt-2 flex items-center gap-1 whitespace-nowrap">{slide.sub}</div>
                </div>
            </div>
        </div>
    );
};

/* ───── MAIN PAGE ───── */
export const DashboardPage = () => {
    const [aiActive, setAiActive] = useState(true);
    const [activeTab, setActiveTab] = useState<"past" | "queue">("past");
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [isLoadingCalls, setIsLoadingCalls] = useState(true);
    const [callQueue, setCallQueue] = useState<QueueItem[]>([]);
    const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
    const [isDirectCallModalOpen, setIsDirectCallModalOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [isCallingNow, setIsCallingNow] = useState(false);
    const [newCallForm, setNewCallForm] = useState({ name: "", phone: "", reason: "" });

    useEffect(() => {
        setIsLoadingCalls(true);
        getConversations()
            .then(data => setCalls(data.map(mapConversation)))
            .catch(() => setCalls([]))
            .finally(() => setIsLoadingCalls(false));
    }, []);

    const handleQuickCall = async () => {
        try {
            setIsCallingNow(true);
            const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
                method: 'POST',
                headers: {
                    'xi-api-key': import.meta.env.VITE_LUNA_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to_number: import.meta.env.VITE_QUICK_CALL_TEST_NUMBER,
                    agent_id: import.meta.env.VITE_LUNA_AGENT_ID,
                    agent_phone_number_id: import.meta.env.VITE_ELEVENLABS_PHONE_NUMBER_ID
                })
            });
            if (response.ok) alert("🤖 Otonom Arama Başlatıldı! Lütfen telefonu açınız.");
            else alert("Hata: " + await response.text());
        } catch(e: any) {
            alert("Arama hatası: " + e.message);
        } finally {
            setIsCallingNow(false);
        }
    };

    const handleAddNewCall = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCallForm.name || !newCallForm.phone) return;

        const newItem = {
            id: Date.now(),
            name: newCallForm.name,
            phone: newCallForm.phone,
            reason: newCallForm.reason || "Genel Arama",
            scheduledFor: new Date(Date.now() + 60_000) // Scheduled for 1 min from now
        };

        setCallQueue(prev => [newItem, ...prev]);
        setNewCallForm({ name: "", phone: "", reason: "" });
        setIsNewCallModalOpen(false);
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
    return (
        <>
            <div className="p-4 md:p-6">

                {/* ── STATS BAR (Static AI Dashboard Blocks) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                    {/* Card 1: Greeting */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50/80 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150"></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mt-1">LUERA AI</p>
                            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition-all duration-500 group-hover:bg-white group-hover:text-blue-600 group-hover:border-blue-100 group-hover:shadow-md">
                                <Sparkles className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-0.5">
                                {greeting}, Gökhan
                            </h3>
                            <p className="text-sm font-medium text-gray-500">Otonom ajanınız göreve hazır.</p>
                        </div>
                    </div>

                    {/* Card 2: System Status */}
                    <div 
                        onClick={() => setIsAnalyticsOpen(true)}
                        className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] cursor-pointer group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.15)] hover:border-emerald-100 hover:-translate-y-1"
                    >
                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-50/60 rounded-full blur-2xl -ml-16 -mt-16 transition-transform duration-700 group-hover:scale-150 group-hover:bg-emerald-100/50"></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="flex items-center gap-2 mt-1">
                                <div className="relative flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                                </div>
                                <p className="text-[10px] font-black text-emerald-600 tracking-[0.2em] uppercase">SİSTEM CANLI</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-sm transition-transform duration-500 group-hover:rotate-[15deg] group-hover:scale-110">
                                <Radio className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-0.5 group-hover:text-emerald-700 transition-colors">Arama Analizi</h3>
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1 group-hover:text-emerald-600 transition-colors">Kayıtlar & Transkriptler <ChevronRight className="w-3.5 h-3.5" /></p>
                        </div>
                    </div>

                    {/* Card 3: Demo Actions */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(204,255,0,0.2)] hover:-translate-y-1 hover:border-slate-700">
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#CCFF00]/10 rounded-full blur-3xl -mr-10 -mb-10 transition-transform duration-1000 group-hover:scale-[1.8] group-hover:bg-[#CCFF00]/15 pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-[#CCFF00] tracking-[0.2em] uppercase mt-1 flex items-center gap-1.5 shadow-[#CCFF00]">
                                <Zap className="w-3.5 h-3.5 fill-[#CCFF00]" /> HIZLI AKSİYON
                            </p>
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shadow-inner transition-colors duration-500 group-hover:text-white group-hover:bg-slate-700/50">
                                <Bot className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10 flex gap-3 w-full mt-auto">
                            <button
                                onClick={() => setIsNewCallModalOpen(true)}
                                className="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl py-3 px-3 flex items-center justify-center gap-2 transition-all text-white hover:text-[#CCFF00]"
                            >
                                <Mic className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Planla</span>
                            </button>
                            
                            <button
                                onClick={handleQuickCall}
                                disabled={isCallingNow}
                                className="flex-[1.5] bg-[#CCFF00] hover:bg-[#d4ff33] active:bg-[#bbf000] rounded-xl py-3 px-3 flex items-center justify-center gap-2 transition-all text-slate-900 shadow-[0_0_15px_rgba(204,255,0,0.3)] hover:shadow-[0_0_25px_rgba(204,255,0,0.5)] disabled:opacity-50 disabled:cursor-wait"
                            >
                                <Phone className="w-4 h-4 fill-slate-900" />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {isCallingNow ? "Aranıyor..." : "Hemen Ara"}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Card 4: Appointments */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(59,130,246,0.15)] hover:border-blue-100 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/60 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150 group-hover:bg-blue-100/50"></div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mt-1">GÜNLÜK HEDEF</p>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-sm transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                                <Target className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">12 Randevu Toplandı</h3>
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-blue-500" /> <span className="text-blue-600 font-bold">%45</span> dönüşüm oranı</p>
                        </div>
                    </div>

                </div>
                <div className="grid grid-cols-1 gap-6">

                    {/* Full width — Call log */}
                    <div className="w-full">
                        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                            <div className="px-6 py-5 border-b border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            Çağrı Kayıtları
                                            <span className="px-2 py-0.5 bg-slate-900 text-[#CCFF00] rounded-md text-xs font-bold">
                                                {activeTab === "past" ? (isLoadingCalls ? "..." : calls.length) : callQueue.length}
                                            </span>
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-0.5">AI destekli gerçek zamanlı çağrı akışı ve kuyruk</p>
                                    </div>

                                    {/* Tabs & Actions */}
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 border border-gray-200/50 rounded-xl">
                                            <button
                                                onClick={() => setActiveTab("past")}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                    activeTab === "past"
                                                        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                                )}
                                            >
                                                Geçmiş Çağrılar
                                            </button>
                                            <button
                                                onClick={() => setActiveTab("queue")}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                    activeTab === "queue"
                                                        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                                )}
                                            >
                                                Bekleyen Kuyruk
                                            </button>
                                        </div>


                                    </div>
                                </div>
                            </div>
                            <div className="p-4 md:p-6 bg-gray-50/50 rounded-b-2xl">
                                <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-2 custom-scrollbar">
                                    {activeTab === "past" ? (
                                        isLoadingCalls ? (
                                            Array.from({ length: 4 }).map((_, i) => <SkeletonCallRow key={i} />)
                                        ) : calls.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                                                    <Phone className="w-7 h-7 text-gray-300" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-500">Henüz çağrı kaydı yok</p>
                                                <p className="text-xs text-gray-400 mt-1">İlk kampanyanızı başlatarak çağrı geçmişi oluşturun</p>
                                            </div>
                                        ) : (
                                            calls.map((call) => (
                                                <div key={call.id}
                                                    onClick={() => setSelectedCall(call)}
                                                    className="flex items-center gap-5 p-5 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-all shadow-sm hover:shadow-md cursor-pointer group">
                                                    <CallTypeIcon type={call.type} status={call.status} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <p className="text-base font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{call.name}</p>
                                                            <TagBadge tag={call.tag} />
                                                        </div>
                                                        <p className="text-sm text-gray-500 font-mono tracking-tight">{call.phone}</p>
                                                    </div>
                                                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                                                        {call.status === "missed" ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                                                                <Circle className="w-2 h-2 fill-current" /> Cevapsız
                                                            </span>
                                                        ) : call.type === "incoming" ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                                                <Circle className="w-2 h-2 fill-current" /> Gelen
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#CCFF00]/10 text-lime-700 text-xs font-bold border border-[#CCFF00]/20">
                                                                <Circle className="w-2 h-2 fill-current" /> Giden
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="hidden lg:flex items-start gap-2.5 max-w-[320px] bg-slate-50/80 border border-slate-100 rounded-xl p-3">
                                                        <Sparkles className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-2">{call.summary}</p>
                                                    </div>
                                                    <div className="hidden md:flex flex-col items-end flex-shrink-0 w-24">
                                                        <p className="text-sm font-bold text-slate-900">{call.duration > 0 ? formatDuration(call.duration) : "–"}</p>
                                                        <p className="text-xs text-slate-400 font-medium mt-1">{getTimeAgo(call.time)}</p>
                                                    </div>
                                                    <div className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight className="w-5 h-5 text-gray-300" />
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    ) : (
                                        callQueue.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-4">
                                                    <CalendarCheck className="w-7 h-7 text-[#CCFF00]" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-500">Kuyruğa alınan çağrı yok</p>
                                                <p className="text-xs text-gray-400 mt-1">Kampanya başlatarak kuyruğu doldurun</p>
                                            </div>
                                        ) : (
                                            callQueue.map((item) => (
                                                <div key={item.id}
                                                    className="flex items-center gap-5 p-5 bg-white border border-gray-100 rounded-2xl hover:border-[#CCFF00]/50 transition-all shadow-sm hover:shadow-md cursor-pointer group">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                        <CalendarCheck className="w-5 h-5 text-[#CCFF00]" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <p className="text-base font-bold text-gray-900 truncate">{item.name}</p>
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-100 uppercase tracking-widest">Bekliyor</span>
                                                        </div>
                                                        <p className="text-sm text-gray-500 font-mono tracking-tight">{item.phone}</p>
                                                    </div>
                                                    <div className="hidden lg:flex items-start gap-2.5 flex-1 bg-amber-50/50 border border-amber-100 rounded-xl p-3">
                                                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                                            <span className="font-bold">Bağlam:</span> {item.reason}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end flex-shrink-0 min-w-[120px]">
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Planlanan Zaman</p>
                                                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                                            <Circle className="w-2 h-2 fill-[#CCFF00] text-[#CCFF00]" />
                                                            {item.scheduledFor.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CALL DETAIL MODAL ── */}
            {selectedCall && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20" onClick={(e) => e.stopPropagation()}>

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-inner">
                                    <Phone className="w-6 h-6 text-gray-700" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedCall.name}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{selectedCall.phone}</p>
                                        <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {getTimeAgo(selectedCall.time)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCall(null)}
                                className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 hover:text-red-500 text-gray-400 transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 bg-gray-50/30 custom-scrollbar">

                                {/* Audio Player Card */}
                            <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#CCFF00]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-transform group-hover:scale-110 duration-700"></div>
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-[#CCFF00]" /> Görüşme Kaydı (Retell AI)
                                </h3>
                                <div className="flex items-center gap-6 relative z-10">
                                    <button className="w-12 h-12 flex-shrink-0 rounded-full bg-[#CCFF00] text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-[#CCFF00]/20">
                                        <Play className="w-5 h-5 ml-1" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        {/* Fake Waveform */}
                                        <div className="flex items-center gap-1 h-12 w-full opacity-80 overflow-hidden px-1">
                                            {Array.from({ length: 90 }).map((_, i) => {
                                                const height = 15 + Math.random() * 85;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex-1 bg-white rounded-full transition-all duration-300 hover:bg-[#CCFF00] cursor-pointer"
                                                        style={{ height: `${height}%`, opacity: Math.random() * 0.4 + 0.3, minWidth: "2px" }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-3 font-mono">
                                            <span>00:00</span>
                                            <span>{formatDuration(selectedCall.duration)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Transcript Area */}
                            <div className="bg-white rounded-[1.5rem] border border-gray-200/60 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-gray-400" /> Canlı Transkript
                                    </h3>

                                    {/* AI Summary Banner */}
                                    <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        <p className="text-[11px] font-bold text-amber-800">
                                            Özet: {selectedCall.summary}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Fake Chat Messages */}
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md mt-1">
                                            <Bot className="w-5 h-5 text-[#CCFF00]" />
                                        </div>
                                        <div className="bg-gray-100 rounded-[1.5rem] rounded-tl-sm p-4 px-5 text-[15px] text-gray-800 font-medium max-w-[85%] leading-relaxed border border-gray-200/50">
                                            Merhaba {selectedCall.name}, ben LUERA. Dünkü görüşmemize istinaden sizi arıyorum. Nasılsınız?
                                        </div>
                                    </div>

                                    <div className="flex gap-4 flex-row-reverse">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                                            <User className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="bg-blue-600 text-white rounded-[1.5rem] rounded-tr-sm p-4 px-5 text-[15px] font-medium max-w-[85%] shadow-md leading-relaxed">
                                            İyiyim teşekkürler. Evet paketlerinizi inceledim. Fiyatlar biraz yüksek geldi ama içeriği çok beğendim.
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md mt-1">
                                            <Bot className="w-5 h-5 text-[#CCFF00]" />
                                        </div>
                                        <div className="bg-gray-100 rounded-[1.5rem] rounded-tl-sm p-4 px-5 text-[15px] text-gray-800 font-medium max-w-[85%] leading-relaxed border border-gray-200/50">
                                            Anlıyorum. İçeriği beğenmeniz harika. Eğer isterseniz, bütçenize daha uygun olan Başlangıç paketimizi size detaylıca anlatabilirim. Ne dersiniz?
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── NEW CALL MODAL (LIVE TEST) ── */}
            {isNewCallModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <LiveTestModal onClose={() => setIsNewCallModalOpen(false)} />
                </div>
            )}

            {/* ── ELEVENLABS ANALYTICS MODAL ── */}
            {isAnalyticsOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <AnalyticsModal onClose={() => setIsAnalyticsOpen(false)} />
                </div>
            )}

            {/* ── DIRECT OUTBOUND CALL MODAL ── */}
            {isDirectCallModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <DirectCallModal onClose={() => setIsDirectCallModalOpen(false)} />
                </div>
            )}
        </>
    );
};

// ── LIVE TEST MODAL COMPONENT (ELEVENLABS SDK REWRITE) ──
import { startElevenLabsConversation } from "@/utils/elevenlabs";
import { BarVisualizer } from "@/components/ui/bar-visualizer";

const LiveTestModal = ({ onClose }: { onClose: () => void }) => {
    const [status, setStatus] = useState<"ready" | "connecting" | "talking" | "ended">("ready");
    const [isCalling, setIsCalling] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [messages, setMessages] = useState<{ id: number; speaker: "ai" | "user"; text: string }[]>([]);
    const conversationRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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
                setStatus("connecting");
                setMessages([]); // Clear history
                const conv = await startElevenLabsConversation({
                    onConnect: () => {
                        setIsCalling(true);
                        setStatus("talking");
                    },
                    onDisconnect: () => {
                        setIsCalling(false);
                        setStatus("ended");
                        setIsAiSpeaking(false);
                        conversationRef.current = null;
                    },
                    onError: (err) => {
                        console.error(err);
                        setIsCalling(false);
                        setStatus("ended");
                        alert("Hata: " + err);
                    },
                    onModeChange: (info) => {
                        setIsAiSpeaking(info.mode === "speaking");
                    },
                    onMessage: (info) => {
                        setMessages((prev) => [...prev, {
                            id: Date.now() + Math.random(),
                            speaker: info.source === "ai" ? "ai" : "user",
                            text: info.message
                        }]);
                    }
                });
                conversationRef.current = conv;
            } catch (error) {
                setStatus("ready");
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (conversationRef.current) {
                try {
                    conversationRef.current.endSession();
                } catch(e) {}
            }
        };
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="bg-[#0B0F19] rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.6)] relative w-full max-w-5xl mx-4 flex flex-col md:flex-row border border-white/10 ring-1 ring-[#CCFF00]/10 overflow-hidden h-[80vh] md:h-[600px] animate-in zoom-in-95 duration-300">
            
            <button onClick={() => {
                if (conversationRef.current) conversationRef.current.endSession();
                onClose();
            }} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 hover:scale-105 p-2 rounded-full z-50">
                 <X className="w-5 h-5"/>
            </button>

            {/* ── LEFT SIDE: ORB & CONTROLS ── */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0B0F19] to-slate-900 border-b md:border-b-0 md:border-r border-white/5 overflow-hidden">
                {/* Minimal Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="z-10 flex flex-col items-center w-full">
                    {/* Focus Area: Bar Visualizer */}
                    <div className="relative mb-12 flex flex-col items-center justify-center min-h-[192px] w-full">
                        {status === "ready" || status === "ended" ? (
                            <button
                                onClick={toggleCall}
                                className="group relative w-32 h-32 rounded-full border border-white/10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm shadow-lg hover:shadow-[0_0_40px_rgba(204,255,0,0.2)] hover:border-[#CCFF00]/50 transition-all duration-500"
                            >
                                <Power className="w-10 h-10 text-slate-500 group-hover:text-[#CCFF00] transition-colors" />
                            </button>
                        ) : (
                            <div className="flex flex-col items-center justify-center w-full cursor-pointer" onClick={toggleCall}>
                                <BarVisualizer 
                                    state={status === "connecting" ? "connecting" : isAiSpeaking ? "speaking" : "listening"}
                                    barCount={28}
                                    minHeight={15}
                                    maxHeight={140}
                                    className="h-40 w-full max-w-[280px]"
                                />
                            </div>
                        )}
                    </div>

                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-white tracking-tight mb-2">LUERA Sesli Asistan</h3>
                        <p className="text-sm text-slate-400 font-medium">
                            {status === "ready" ? "Görüşmeyi başlatmak için dokunun" : 
                             status === "connecting" ? "Bağlantı kuruluyor..." : 
                             status === "talking" ? (isAiSpeaking ? "Size yanıt veriyor..." : "Sizi dinliyor, konuşabilirsiniz...") : "Görüşme sonlandırıldı."}
                        </p>
                    </div>

                    {isCalling && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                            <button 
                                onClick={toggleCall}
                                className="w-16 h-16 rounded-full flex items-center justify-center text-white bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] transition-all"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT SIDE: TRANSCRIPT ── */}
            <div className="flex-[1.2] flex flex-col bg-[#0B0F19] relative max-h-[50vh] md:max-h-full">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3 bg-slate-900/20 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">Canlı Transkript</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Gerçek Zamanlı Döküm</p>
                    </div>
                </div>
                
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar scroll-smooth">
                    {messages.length === 0 && status !== "talking" && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                            <Bot className="w-12 h-12 text-slate-600 mb-4" />
                            <p className="text-sm font-medium text-slate-400 max-w-[200px]">
                                Konuşma başladığında dökümler temiz ve şık bir şekilde burada görünecek.
                            </p>
                        </div>
                    )}
                    
                    {messages.map((msg) => {
                        const isAI = msg.speaker === "ai";
                        if (isAI) {
                            return (
                                <div key={msg.id} className="flex w-full items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
                                    {/* Miniature Orb Avatar for AI */}
                                    <div className="w-9 h-9 shrink-0 rounded-full border border-white/10 bg-slate-900 flex items-center justify-center overflow-hidden relative shadow-[0_0_15px_rgba(204,255,0,0.1)] mt-1">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#CCFF00]/40 via-lime-500/10 to-transparent animate-spin-slow mix-blend-screen" />
                                        <Bot className="w-4 h-4 text-[#CCFF00]/80 relative z-10" />
                                    </div>
                                    {/* Clean Text Response (No Bubble) */}
                                    <div className="text-slate-200 text-[15px] leading-relaxed pt-2 w-full font-medium">
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div key={msg.id} className="flex w-full justify-end animate-in fade-in slide-in-from-bottom-2">
                                    {/* Minimalist User Input Bubble */}
                                    <div className="bg-slate-800 text-slate-100 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[15px] shadow-sm border border-white/5 leading-relaxed">
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        }
                    })}
                </div>

            </div>
            
        </div>
    );
};

// ── ELEVENLABS ANALYTICS MODAL COMPONENT ──
const AnalyticsModal = ({ onClose }: { onClose: () => void }) => {
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        getConversations()
            .then(data => {
                setCalls(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load generic calls from ElevenLabs", err);
                setLoading(false);
            });
    }, []);

    const fetchDetail = async (callId: string) => {
        setSelectedDetail(null);
        setAudioUrl(null);
        try {
            const detail = await getConversationDetails(callId);
            setSelectedDetail(detail);
            
            // Try fetching audio if available
            try {
                const audio = await getConversationAudio(callId);
                setAudioUrl(audio);
            } catch (aErr) {
                console.log("No audio available");
            }
        } catch (e) {
            alert("Arama detayı alınamadı!");
        }
    };

    const toggleAudio = () => {
        if (!audioRef.current) return;
        if (audioPlaying) {
            audioRef.current.pause();
            setAudioPlaying(false);
        } else {
            audioRef.current.play();
            setAudioPlaying(true);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[85vh] ring-1 ring-black/5 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Left Sidebar: Call List */}
            <div className="w-full md:w-[340px] bg-white border-r border-gray-100 flex flex-col shrink-0 max-h-[40vh] md:max-h-none">
                <div className="px-6 py-5 border-b border-gray-100 bg-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-slate-900 tracking-tight text-lg">Arama Kayıtları</h3>
                            <p className="text-xs text-slate-400 mt-0.5">{calls.length} görüşme kaydı</p>
                        </div>
                        {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                    {loading && calls.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin mb-3" />
                            <p className="text-sm font-medium">Veriler yükleniyor...</p>
                        </div>
                    )}
                    {!loading && calls.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Phone className="w-8 h-8 mb-3 opacity-30" />
                            <p className="text-sm font-medium">Henüz kayıt yok</p>
                        </div>
                    )}
                    {calls.map((c: any, index: number) => {
                        const callDate = new Date(c.start_time_unix_secs * 1000);
                        const timeStr = callDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = callDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                        const isSelected = selectedDetail?.conversation_id === c.conversation_id;
                        const isDone = c.status === "done";
                        
                        return (
                            <div 
                                key={c.conversation_id} 
                                onClick={() => fetchDetail(c.conversation_id)} 
                                className={cn(
                                    "px-4 py-3 rounded-xl cursor-pointer transition-all flex items-center gap-3",
                                    isSelected 
                                        ? "bg-slate-900 text-white shadow-lg" 
                                        : "hover:bg-gray-50 text-slate-700"
                                )}
                            >
                                <div className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                    isSelected ? "bg-[#CCFF00]/20" : isDone ? "bg-emerald-50" : "bg-amber-50"
                                )}>
                                    <Phone className={cn(
                                        "w-4 h-4",
                                        isSelected ? "text-[#CCFF00]" : isDone ? "text-emerald-500" : "text-amber-500"
                                    )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={cn("text-sm font-semibold truncate", isSelected ? "text-white" : "text-slate-800")}>
                                            Görüşme #{index + 1}
                                        </p>
                                        <span className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0",
                                            isSelected 
                                                ? "bg-emerald-400/20 text-emerald-300" 
                                                : isDone ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                        )}>
                                            {isDone ? "✓" : "..."}
                                        </span>
                                    </div>
                                    <p className={cn("text-[11px] mt-0.5", isSelected ? "text-slate-300" : "text-slate-400")}>
                                        {dateStr} · {timeStr}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Side: Detail */}
            <div className="flex-1 bg-gray-50/50 flex flex-col relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors z-50">
                    <X className="w-5 h-5" />
                </button>

                {!selectedDetail ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <Sparkles className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="font-semibold text-slate-500">Bir görüşme seçin</p>
                        <p className="text-sm text-slate-400 mt-1">Detayları ve transkripti görüntüleyin</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Görüşme Analizi</h2>
                            <p className="text-xs text-slate-400 font-mono truncate">{selectedDetail.conversation_id}</p>
                        </div>

                        {/* Audio Player Row */}
                        <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group mb-6">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-[#CCFF00]/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Volume2 className="w-3.5 h-3.5 text-[#CCFF00]" /> Ses Kaydı
                            </h3>
                            <div className="flex items-center gap-4 relative z-10">
                                {audioUrl ? (
                                    <>
                                        <audio ref={audioRef} src={audioUrl} onEnded={() => setAudioPlaying(false)} className="hidden" />
                                        <button onClick={toggleAudio} className="w-10 h-10 flex-shrink-0 rounded-full bg-[#CCFF00] text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg">
                                            {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-[2px] h-8 w-full overflow-hidden">
                                                {Array.from({ length: 70 }).map((_, i) => (
                                                    <div key={i} className="flex-1 bg-white/30 rounded-full transition-all duration-300" style={{ height: `${10 + Math.random() * 90}%`, opacity: audioPlaying ? Math.random() * 0.5 + 0.5 : 0.15 }} />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500 font-medium">Bu görüşme için ses kaydı mevcut değil.</p>
                                )}
                            </div>
                        </div>

                        {/* Transcript Row */}
                        <div className="bg-white rounded-2xl border border-gray-200/60 p-5 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-5">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400" /> Transkript
                            </h3>
                            
                            <div className="space-y-3">
                                {selectedDetail.transcript?.map((msg: any, i: number) => {
                                    const isAgent = msg.role === "agent";
                                    return (
                                        <div key={i} className={cn("flex gap-3", !isAgent && "flex-row-reverse")}>
                                            <div className={cn("w-8 h-8 rounded-xl flex flex-shrink-0 items-center justify-center", isAgent ? "bg-slate-900" : "bg-blue-50 border border-blue-100")}>
                                                {isAgent ? <Bot className="w-4 h-4 text-[#CCFF00]" /> : <User className="w-4 h-4 text-blue-600" />}
                                            </div>
                                            <div className={cn("rounded-2xl p-3 px-4 text-sm font-medium max-w-[80%] leading-relaxed", isAgent ? "bg-gray-50 text-gray-800 rounded-tl-md" : "bg-blue-600 text-white rounded-tr-md shadow-sm")}>
                                                {msg.message || msg.text || "(Boş mesaj)"}
                                            </div>
                                        </div>
                                    );
                                })}
                                {!selectedDetail.transcript?.length && (
                                    <p className="text-sm text-gray-400 text-center py-4">Transkript bulunamadı.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};