import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
    Phone, PhoneMissed, ArrowDownLeft, ArrowUpRight,
    Mic, Sparkles, TrendingUp, ChevronRight, Circle,
    CheckCircle2, Zap, Clock,
    X, Play, Pause, Volume2, MessageSquare, Bot, User,
    Flame, Snowflake, RefreshCw, Power, PhoneOff, Loader2,
    PhoneCall, BarChart3,
} from "lucide-react";
import { QuickCallModal } from "@/components/QuickCallModal";
import { cn, formatDuration, getTimeAgo } from "@/utils/cn";
import { getConversations, getConversationDetails, getConversationAudio, getUserSubscription, UserSubscription, CHAR_RATE_TRY, CHARS_PER_MINUTE } from "@/services/elevenlabsApi";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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
const mapConversation = (conv: any): CallRecord => {
    // ElevenLabs returns call_successful as "success" | "failure" | null
    const isFailed =
        conv.call_successful === "failure" ||
        conv.call_successful === false ||
        conv.status === "failed" ||
        conv.status === "error";

    // Duration — try multiple fields
    const duration =
        conv.call_duration_secs ??
        conv.duration_secs ??
        conv.duration ??
        0;

    // Phone number — several locations ElevenLabs may place it
    const phone =
        conv.metadata?.phone_number ||
        conv.metadata?.to_number ||
        conv.metadata?.caller_id ||
        conv.from_number ||
        conv.to_number ||
        "–";

    // Display name — prefer a human summary title, fall back to phone
    const name =
        conv.call_summary_title ||
        conv.summary_title ||
        phone;

    // Call summary text
    const summary =
        conv.transcript_summary ||
        conv.analysis?.transcript_summary ||
        conv.metadata?.summary ||
        "Özet henüz oluşturulmadı.";

    // Start time
    const startTime = conv.start_time_unix_secs
        ? new Date(conv.start_time_unix_secs * 1000)
        : conv.created_at
            ? new Date(conv.created_at)
            : new Date();

    return {
        id: conv.conversation_id,
        conversationId: conv.conversation_id,
        name,
        phone,
        type: conv.direction === "inbound" ? "incoming" : "outgoing",
        status: isFailed || duration === 0 ? "missed" : "answered",
        tag: "cold",
        duration,
        time: startTime,
        summary,
    };
};

/* ───── SUB-COMPONENTS ───── */
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

/* ───── MAIN PAGE ───── */
export const DashboardPage = () => {
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [isLoadingCalls, setIsLoadingCalls] = useState(true);
    const [callsError, setCallsError] = useState<string | null>(null);
    const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
    const [isQuickCallOpen, setIsQuickCallOpen] = useState(false);
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);

    useEffect(() => {
        getUserSubscription().then(setSubscription).catch(() => { /* optional */ });
    }, []);
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchCalls = useCallback(async () => {
        setIsLoadingCalls(true);
        setCallsError(null);
        try {
            const data = await getConversations();
            const mapped = data.map(mapConversation);
            setCalls(mapped);
            setIsLoadingCalls(false);

            // Background: enrich first 20 calls with exact phone number from detail API
            const details = await Promise.allSettled(
                mapped.slice(0, 20).map(c =>
                    c.conversationId ? getConversationDetails(c.conversationId) : Promise.resolve(null)
                )
            );
            setCalls(prev => prev.map((call, i) => {
                const result = details[i];
                if (result?.status === "fulfilled" && result.value) {
                    const phone =
                        result.value?.metadata?.phone_call?.external_number ||
                        result.value?.metadata?.to_number ||
                        result.value?.metadata?.phone_number;
                    if (phone) {
                        return {
                            ...call,
                            phone,
                            name: call.name === "–" || call.name === call.phone ? phone : call.name,
                        };
                    }
                }
                return call;
            }));
        } catch (err: any) {
            setCallsError("Çağrı verileri yüklenirken bir hata oluştu.");
            setCalls([]);
            setIsLoadingCalls(false);
        }
    }, []);

    useEffect(() => {
        fetchCalls();
    }, [fetchCalls]);

    // Load call detail + audio when a call is selected
    useEffect(() => {
        if (!selectedCall?.conversationId) {
            setSelectedDetail(null);
            setAudioUrl(null);
            setAudioPlaying(false);
            return;
        }
        setLoadingDetail(true);
        setSelectedDetail(null);
        setAudioUrl(null);
        setAudioPlaying(false);

        getConversationDetails(selectedCall.conversationId)
            .then(detail => setSelectedDetail(detail))
            .catch(() => setSelectedDetail(null))
            .finally(() => setLoadingDetail(false));

        getConversationAudio(selectedCall.conversationId)
            .then(url => setAudioUrl(url))
            .catch(() => setAudioUrl(null));
    }, [selectedCall]);

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

    const { user } = useAuth();
    const firstName = user?.user_metadata?.full_name?.split(" ")[0]
        || user?.email?.split("@")[0]
        || "";

    const stats = useMemo(() => {
        const total = calls.length;
        const answered = calls.filter(c => c.status === "answered" && c.duration > 0).length;
        const missed = calls.filter(c => c.status === "missed").length;
        const totalDuration = calls.reduce((a, c) => a + (c.duration || 0), 0);
        const avgDuration = answered > 0 ? Math.round(totalDuration / answered) : 0;
        const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;
        return { total, answered, missed, avgDuration, answerRate };
    }, [calls]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

    return (
        <>
            <div className="p-4 md:p-6">

                {/* ── STATS BAR ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                    {/* Card 1: Greeting */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50/80 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mt-1">LUERA AI</p>
                            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition-all duration-500 group-hover:bg-white group-hover:text-blue-600 group-hover:border-blue-100 group-hover:shadow-md">
                                <Sparkles className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-0.5">
                                {greeting}{firstName ? `, ${firstName}` : ""}
                            </h3>
                            <p className="text-sm font-medium text-gray-500">Otonom ajanınız göreve hazır.</p>
                        </div>
                    </div>

                    {/* Card 2: Toplam Arama */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.15)] hover:border-emerald-100 hover:-translate-y-1">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-50/60 rounded-full blur-2xl -ml-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="flex items-center gap-2 mt-1">
                                <div className="relative flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
                                </div>
                                <p className="text-[10px] font-black text-emerald-600 tracking-[0.2em] uppercase">SİSTEM CANLI</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-sm transition-transform duration-500 group-hover:rotate-[15deg] group-hover:scale-110">
                                <Phone className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            {isLoadingCalls ? (
                                <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse mb-1" />
                            ) : (
                                <h3 className="text-3xl font-black tracking-tight text-gray-900 mb-0.5">{stats.total}</h3>
                            )}
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                                Toplam Arama
                                <span className="ml-1 text-red-500 font-bold text-xs">{stats.missed > 0 ? `· ${stats.missed} cevapsız` : ""}</span>
                            </p>
                        </div>
                    </div>

                    {/* Card 3: Hızlı Aksiyon */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(204,255,0,0.2)] hover:-translate-y-1 hover:border-slate-700">
                        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#CCFF00]/10 rounded-full blur-3xl -mr-10 -mb-10 transition-transform duration-1000 group-hover:scale-[1.8] group-hover:bg-[#CCFF00]/15 pointer-events-none" />
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-[#CCFF00] tracking-[0.2em] uppercase mt-1 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 fill-[#CCFF00]" /> HIZLI AKSİYON
                            </p>
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shadow-inner transition-colors duration-500 group-hover:text-white group-hover:bg-slate-700/50">
                                <Bot className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10 grid grid-cols-2 gap-2 w-full mt-auto">
                            <button
                                onClick={() => setIsQuickCallOpen(true)}
                                className="bg-[#CCFF00] hover:bg-[#d4ff33] active:bg-[#bbf000] rounded-xl py-3 px-2 flex items-center justify-center gap-1.5 transition-all text-slate-900 shadow-[0_0_15px_rgba(204,255,0,0.3)] hover:shadow-[0_0_25px_rgba(204,255,0,0.5)]"
                                title="Tek numarayı hemen arat"
                            >
                                <PhoneCall className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Hızlı Arama</span>
                            </button>
                            <button
                                onClick={() => setIsNewCallModalOpen(true)}
                                className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 rounded-xl py-3 px-2 flex items-center justify-center gap-1.5 transition-all text-white"
                                title="Tarayıcı üzerinden sesli demo"
                            >
                                <Mic className="w-4 h-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Sesli Demo</span>
                            </button>
                        </div>
                    </div>

                    {/* Card 4: Yanıtlanma Oranı */}
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[140px] group transition-all duration-500 hover:shadow-[0_8px_30px_-12px_rgba(59,130,246,0.15)] hover:border-blue-100 hover:-translate-y-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/60 rounded-full blur-2xl -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase mt-1">PERFORMANS</p>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-sm transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="relative z-10">
                            {isLoadingCalls ? (
                                <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse mb-1" />
                            ) : (
                                <h3 className="text-3xl font-black tracking-tight text-gray-900 mb-0.5 group-hover:text-blue-700 transition-colors">
                                    %{stats.answerRate}
                                </h3>
                            )}
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                Yanıtlanma oranı
                                {stats.avgDuration > 0 && (
                                    <span className="text-blue-600 font-bold">· ort. {formatDuration(stats.avgDuration)}</span>
                                )}
                            </p>
                        </div>
                    </div>

                </div>

                {/* ── USAGE STRIP ── */}
                {subscription && (() => {
                    const used = subscription.character_count || 0;
                    const limit = subscription.character_limit || 0;
                    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    const estTRY = used * CHAR_RATE_TRY;
                    const estMin = Math.round(used / CHARS_PER_MINUTE);
                    const barCls = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-[#CCFF00]";
                    return (
                        <Link
                            to="/usage"
                            className="block bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-[#CCFF00]/50 transition-all mb-6 group"
                        >
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                                <div className="flex items-center gap-3 min-w-[180px]">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                                        <BarChart3 className="w-5 h-5 text-[#CCFF00]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bu Dönem</p>
                                        <p className="text-sm font-black text-slate-900">Kullanım & Tahmini Fatura</p>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5 text-xs font-bold">
                                        <span className="text-slate-600">
                                            {used.toLocaleString("tr-TR")} karakter · ≈ {estMin} dk
                                        </span>
                                        <span className="text-slate-900">%{pct}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all duration-700", barCls)} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:border-l md:border-slate-100 md:pl-4">
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tahmini</p>
                                        <p className="text-xl font-black text-emerald-600">
                                            {estTRY.toLocaleString("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="text-xs font-black text-slate-400 group-hover:text-slate-900 transition-colors whitespace-nowrap">
                                        Detay →
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })()}

                {/* ── CALL LOG ── */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="w-full">
                        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm">
                            <div className="px-6 py-5 border-b border-gray-100">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            Çağrı Kayıtları
                                            <span className="px-2 py-0.5 bg-slate-900 text-[#CCFF00] rounded-md text-xs font-bold">
                                                {isLoadingCalls ? "..." : calls.length}
                                            </span>
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-0.5">Gerçek zamanlı çağrı verisi</p>
                                    </div>

                                    {/* Refresh Button */}
                                    <button
                                        onClick={fetchCalls}
                                        disabled={isLoadingCalls}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                                            isLoadingCalls
                                                ? "border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed"
                                                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm"
                                        )}
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", isLoadingCalls && "animate-spin")} />
                                        Yenile
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 md:p-6 bg-gray-50/50 rounded-b-2xl">
                                <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-2 custom-scrollbar">
                                    {isLoadingCalls ? (
                                        Array.from({ length: 4 }).map((_, i) => <SkeletonCallRow key={i} />)
                                    ) : callsError ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                                                <PhoneMissed className="w-7 h-7 text-red-300" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-500">{callsError}</p>
                                            <button
                                                onClick={fetchCalls}
                                                className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                Tekrar dene
                                            </button>
                                        </div>
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
                                                        <p className="text-base font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                                            {call.phone && call.phone !== "–" ? call.phone : call.name}
                                                        </p>
                                                        <TagBadge tag={call.tag} />
                                                    </div>
                                                    <p className="text-sm text-gray-500 font-mono tracking-tight">
                                                        {call.phone && call.phone !== "–"
                                                            ? call.name
                                                            : <span className="text-slate-300 italic text-xs">numara yükleniyor...</span>
                                                        }
                                                    </p>
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

                        {/* Audio Player — sticky, scroll dışında */}
                        <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/5 relative overflow-hidden">
                            {/* glow arka plan */}
                            <div className="absolute inset-0 bg-[#CCFF00]/5 pointer-events-none" />
                            <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-40 h-40 bg-[#CCFF00]/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="relative z-10 px-8 py-5 flex items-center gap-5">
                                {/* İkon + label */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="w-8 h-8 rounded-xl bg-[#CCFF00]/15 flex items-center justify-center">
                                        <Volume2 className="w-4 h-4 text-[#CCFF00]" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Ses Kaydı</span>
                                </div>

                                {audioUrl ? (
                                    <>
                                        <audio ref={audioRef} src={audioUrl} onEnded={() => setAudioPlaying(false)} className="hidden" />

                                        {/* Play/Pause butonu */}
                                        <button
                                            onClick={toggleAudio}
                                            className="w-11 h-11 flex-shrink-0 rounded-full bg-[#CCFF00] text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#CCFF00]/20"
                                        >
                                            {audioPlaying
                                                ? <Pause className="w-4 h-4" />
                                                : <Play className="w-4 h-4 ml-0.5" />}
                                        </button>

                                        {/* Waveform + süre */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                                            <div className="flex items-end gap-[2px] h-9 w-full overflow-hidden">
                                                {Array.from({ length: 80 }).map((_, i) => {
                                                    const h = 15 + Math.sin(i * 0.6) * 35 + Math.cos(i * 1.1) * 25 + 35;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex-1 rounded-full transition-all duration-500"
                                                            style={{
                                                                height: `${h}%`,
                                                                minWidth: "2px",
                                                                background: audioPlaying
                                                                    ? `rgba(204,255,0,${0.4 + Math.sin(i * 0.4) * 0.35})`
                                                                    : "rgba(255,255,255,0.15)",
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between text-[10px] font-mono font-bold text-slate-500">
                                                <span>00:00</span>
                                                <span>{formatDuration(selectedCall.duration)}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : loadingDetail ? (
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#CCFF00]" />
                                        <span className="text-sm font-medium">Ses kaydı yükleniyor...</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 font-medium">Bu görüşme için ses kaydı mevcut değil.</p>
                                )}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 bg-gray-50/30 custom-scrollbar">

                            {/* Transcript Area */}
                            <div className="bg-white rounded-[1.5rem] border border-gray-200/60 p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-gray-400" /> Transkript
                                    </h3>
                                    {selectedCall.summary && selectedCall.summary !== "Özet henüz oluşturulmadı." && (
                                        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                            <p className="text-[11px] font-bold text-amber-800 max-w-[300px] truncate">
                                                {selectedCall.summary}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {loadingDetail && !selectedDetail ? (
                                    <div className="flex items-center justify-center gap-3 py-10 text-gray-400">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-sm font-medium">Transkript yükleniyor...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {selectedDetail?.transcript?.map((msg: any, i: number) => {
                                            const isAgent = msg.role === "agent";
                                            return (
                                                <div key={i} className={cn("flex gap-4", !isAgent && "flex-row-reverse")}>
                                                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md mt-1", isAgent ? "bg-slate-900" : "bg-blue-50 border border-blue-100")}>
                                                        {isAgent ? <Bot className="w-5 h-5 text-[#CCFF00]" /> : <User className="w-5 h-5 text-blue-600" />}
                                                    </div>
                                                    <div className={cn("rounded-[1.5rem] p-4 px-5 text-[15px] font-medium max-w-[85%] leading-relaxed", isAgent ? "bg-gray-100 text-gray-800 rounded-tl-sm border border-gray-200/50" : "bg-blue-600 text-white rounded-tr-sm shadow-md")}>
                                                        {msg.message || msg.text || "(Boş mesaj)"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {!selectedDetail?.transcript?.length && (
                                            <p className="text-sm text-gray-400 text-center py-8">Transkript bulunamadı.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── LIVE TEST MODAL ── */}
            {isNewCallModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <LiveTestModal onClose={() => setIsNewCallModalOpen(false)} />
                </div>
            )}

            {/* ── QUICK OUTBOUND CALL MODAL ── */}
            <QuickCallModal isOpen={isQuickCallOpen} onClose={() => setIsQuickCallOpen(false)} />
        </>
    );
};

// ── LIVE TEST MODAL COMPONENT (ELEVENLABS SDK) ──
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
                setMessages([]);
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
            } catch {
                setStatus("ready");
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (conversationRef.current) {
                try { conversationRef.current.endSession(); } catch { /* ignore */ }
            }
        };
    }, []);

    // Auto-scroll transcript
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
                <X className="w-5 h-5" />
            </button>

            {/* ── LEFT: ORB & CONTROLS ── */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0B0F19] to-slate-900 border-b md:border-b-0 md:border-r border-white/5 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="z-10 flex flex-col items-center w-full">
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

            {/* ── RIGHT: TRANSCRIPT ── */}
            <div className="flex-[1.2] flex flex-col bg-[#0B0F19] relative max-h-[50vh] md:max-h-full">
                <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3 bg-slate-900/20 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#CCFF00]/10 flex items-center justify-center text-[#CCFF00]">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">Canlı Transkript</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Gerçek Zamanlı Döküm</p>
                    </div>
                </div>

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
                                    <div className="w-9 h-9 shrink-0 rounded-full border border-white/10 bg-slate-900 flex items-center justify-center overflow-hidden relative shadow-[0_0_15px_rgba(204,255,0,0.1)] mt-1">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#CCFF00]/40 via-lime-500/10 to-transparent animate-spin-slow mix-blend-screen" />
                                        <Bot className="w-4 h-4 text-[#CCFF00]/80 relative z-10" />
                                    </div>
                                    <div className="text-slate-200 text-[15px] leading-relaxed pt-2 w-full font-medium">
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <div key={msg.id} className="flex w-full justify-end animate-in fade-in slide-in-from-bottom-2">
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
