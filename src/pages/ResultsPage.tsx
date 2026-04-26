import { useEffect, useMemo, useState } from "react";
import {
    Search, Phone, ArrowDownLeft, ArrowUpRight, PhoneMissed,
    Sparkles, Clock, X, Flame, Snowflake, CalendarCheck,
    Loader2, RefreshCw, CheckCircle2, XCircle, HelpCircle,
    Database, Target, MessageSquare, Calendar, BrainCircuit,
    Users, List,
} from "lucide-react";
import { cn, formatDuration, getTimeAgo } from "@/utils/cn";
import { getConversations, getConversationDetails, getAgents, AgentListItem, makeOutboundCall } from "@/services/elevenlabsApi";

type Tag = "hot" | "cold" | "appointment" | "missed" | "unknown";
type FilterType = "all" | Tag;

interface CallItem {
    id: string;
    conversationId: string;
    agentId?: string;
    agentName?: string;
    name: string;
    phone: string;
    type: "incoming" | "outgoing";
    duration: number;
    time: Date;
    tag: Tag;
    summary: string;
    callSuccessful?: "success" | "failure" | "unknown" | null;
    evaluationResults?: EvalResult[];
    dataResults?: DataResult[];
    loadingDetail?: boolean;
    detailLoaded?: boolean;
}

type DateRange = "all" | "today" | "yesterday" | "7d" | "30d";

interface EvalResult {
    id: string;
    name: string;
    result: "success" | "failure" | "unknown";
    rationale?: string;
}

interface DataResult {
    name: string;
    value: string | number | boolean | null;
    rationale?: string;
}

interface TranscriptMsg {
    role: "agent" | "user";
    text: string;
}

/* ───── MAP ───── */
const deriveTag = (duration: number, callSuccessful: any, evalResults: EvalResult[]): Tag => {
    if (duration === 0) return "missed";

    // If any criterion explicitly mentions "appointment" / "randevu" and is success → appointment
    const appointmentHit = evalResults.find(
        r =>
            r.result === "success" &&
            /randev|appointment|appt/i.test(r.name)
    );
    if (appointmentHit) return "appointment";

    if (callSuccessful === "success") return "hot";
    if (callSuccessful === "failure") return "cold";

    // Fallback: majority of evaluation results
    if (evalResults.length > 0) {
        const successes = evalResults.filter(r => r.result === "success").length;
        const failures = evalResults.filter(r => r.result === "failure").length;
        if (successes > failures) return "hot";
        if (failures > successes) return "cold";
    }

    return "unknown";
};

const mapConversation = (conv: any): CallItem => {
    const duration = conv.call_duration_secs ?? conv.duration_secs ?? 0;
    const phone =
        conv.metadata?.phone_call?.external_number ||
        conv.metadata?.phone_number ||
        conv.metadata?.to_number ||
        conv.to_number ||
        "–";
    const name = conv.call_summary_title || conv.summary_title || phone;
    const summary =
        conv.transcript_summary ||
        conv.analysis?.transcript_summary ||
        "";
    const startTime = conv.start_time_unix_secs
        ? new Date(conv.start_time_unix_secs * 1000)
        : new Date();

    return {
        id: conv.conversation_id,
        conversationId: conv.conversation_id,
        agentId: conv.agent_id || conv.agentId,
        agentName: conv.agent_name,
        name,
        phone,
        type: conv.direction === "inbound" ? "incoming" : "outgoing",
        duration,
        time: startTime,
        tag: duration === 0 ? "missed" : "unknown",
        summary,
        callSuccessful: conv.call_successful ?? null,
        evaluationResults: [],
        dataResults: [],
    };
};

/** Returns [startMs, endMs] (inclusive start, exclusive end) for a date range preset. */
const dateRangeBounds = (r: DateRange): [number, number] | null => {
    if (r === "all") return null;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(now);
    if (r === "today") return [today, today + 86400_000];
    if (r === "yesterday") return [today - 86400_000, today];
    if (r === "7d") return [today - 7 * 86400_000, today + 86400_000];
    if (r === "30d") return [today - 30 * 86400_000, today + 86400_000];
    return null;
};

const extractAnalysis = (detail: any): {
    evaluationResults: EvalResult[];
    dataResults: DataResult[];
    summary?: string;
    callSuccessful?: any;
    transcript: TranscriptMsg[];
} => {
    const a = detail?.analysis || {};

    const rawEval = a.evaluation_criteria_results || {};
    const evaluationResults: EvalResult[] = Object.entries(rawEval).map(
        ([id, v]: [string, any]) => ({
            id,
            name: v?.criteria_id || v?.name || id,
            result: (v?.result as any) || "unknown",
            rationale: v?.rationale,
        })
    );

    const rawData = a.data_collection_results || {};
    const dataResults: DataResult[] = Object.entries(rawData).map(
        ([name, v]: [string, any]) => ({
            name,
            value: v?.value ?? null,
            rationale: v?.rationale,
        })
    );

    const rawTranscript: any[] = detail?.transcript || [];
    const transcript: TranscriptMsg[] = rawTranscript
        .map(m => ({
            role: (m.role === "user" ? "user" : "agent") as "agent" | "user",
            text: m.message || m.text || "",
        }))
        .filter(m => m.text);

    return {
        evaluationResults,
        dataResults,
        summary: a.transcript_summary,
        callSuccessful: a.call_successful ?? detail?.call_successful,
        transcript,
    };
};

/* ───── Custom Checkbox ───── */
const Checkbox = ({
    checked,
    onChange,
    onClick,
    indeterminate = false,
}: {
    checked: boolean;
    onChange: () => void;
    onClick?: (e: React.MouseEvent) => void;
    indeterminate?: boolean;
}) => (
    <button
        type="button"
        onClick={(e) => { onClick?.(e); onChange(); }}
        className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150 border-2",
            checked || indeterminate
                ? "bg-slate-900 border-slate-900 shadow-sm"
                : "bg-white border-slate-300 hover:border-slate-500"
        )}
    >
        {indeterminate && !checked ? (
            <span className="w-2 h-0.5 bg-[#CCFF00] rounded-full" />
        ) : checked ? (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4L4 7.5L10 1" stroke="#CCFF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ) : null}
    </button>
);

/* ───── UI PARTS ───── */
const TagBadge = ({ tag }: { tag: Tag }) => {
    if (tag === "hot") return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-600 border border-orange-100"><Flame className="w-3 h-3" />Başarılı</span>;
    if (tag === "cold") return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100"><Snowflake className="w-3 h-3" />Başarısız</span>;
    if (tag === "appointment") return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-600 border border-purple-100"><CalendarCheck className="w-3 h-3" />Randevu</span>;
    if (tag === "missed") return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 border border-red-100"><PhoneMissed className="w-3 h-3" />Cevapsız</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><HelpCircle className="w-3 h-3" />Belirsiz</span>;
};

const EvalResultIcon = ({ result }: { result: "success" | "failure" | "unknown" }) => {
    if (result === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (result === "failure") return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-slate-400" />;
};

/* ───── PAGE ───── */
export const ResultsPage = () => {
    const [filter, setFilter] = useState<FilterType>("all");
    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>("all");
    const [agentFilter, setAgentFilter] = useState<string>("all");
    const [agents, setAgents] = useState<AgentListItem[]>([]);
    const [calls, setCalls] = useState<CallItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<CallItem | null>(null);
    const [detailTranscript, setDetailTranscript] = useState<TranscriptMsg[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [viewMode, setViewMode] = useState<"calls" | "contacts">("calls");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [retrying, setRetrying] = useState(false);
    const [retryResults, setRetryResults] = useState<{ success: number; fail: number } | null>(null);

    const fetchCalls = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getConversations();
            const mapped = data.map(mapConversation);
            setCalls(mapped);
            setIsLoading(false);

            // Enrich first 30 with analysis details to derive tags
            const slice = mapped.slice(0, 30);
            const details = await Promise.allSettled(
                slice.map(c => getConversationDetails(c.conversationId))
            );
            setCalls(prev => {
                const byId = new Map(prev.map(c => [c.id, c]));
                slice.forEach((c, i) => {
                    const r = details[i];
                    if (r.status !== "fulfilled" || !r.value) return;
                    const a = extractAnalysis(r.value);
                    const callSuccessful = a.callSuccessful ?? c.callSuccessful;
                    const tag = deriveTag(c.duration, callSuccessful, a.evaluationResults);
                    const phone =
                        r.value?.metadata?.phone_call?.external_number ||
                        r.value?.metadata?.to_number ||
                        c.phone;
                    byId.set(c.id, {
                        ...c,
                        tag,
                        callSuccessful,
                        evaluationResults: a.evaluationResults,
                        dataResults: a.dataResults,
                        summary: a.summary || c.summary,
                        phone,
                        name: c.name === "–" || c.name === c.phone ? phone : c.name,
                        detailLoaded: true,
                    });
                });
                return Array.from(byId.values());
            });
        } catch (err: any) {
            setError("Çağrı verileri yüklenemedi.");
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalls();
        // Fetch agents list once for the filter dropdown
        getAgents()
            .then(list => setAgents(list))
            .catch(() => setAgents([]));
    }, []);

    // Load transcript when a call is selected (for calls beyond the first 30, also load analysis)
    useEffect(() => {
        if (!selected) {
            setDetailTranscript([]);
            return;
        }
        setLoadingDetail(true);
        setDetailTranscript([]);
        getConversationDetails(selected.conversationId)
            .then(detail => {
                const a = extractAnalysis(detail);
                setDetailTranscript(a.transcript);
                // If we didn't have analysis cached, update the selected + list
                if (!selected.detailLoaded) {
                    setSelected(prev => prev ? {
                        ...prev,
                        evaluationResults: a.evaluationResults,
                        dataResults: a.dataResults,
                        summary: a.summary || prev.summary,
                        callSuccessful: a.callSuccessful ?? prev.callSuccessful,
                        tag: deriveTag(prev.duration, a.callSuccessful, a.evaluationResults),
                        detailLoaded: true,
                    } : prev);
                }
            })
            .catch(() => setDetailTranscript([]))
            .finally(() => setLoadingDetail(false));
    }, [selected?.conversationId]);

    // Pre-filter by date + agent (used for both counts and visible rows)
    const scoped = useMemo(() => {
        const bounds = dateRangeBounds(dateRange);
        return calls.filter(r => {
            if (bounds) {
                const t = r.time.getTime();
                if (t < bounds[0] || t >= bounds[1]) return false;
            }
            if (agentFilter !== "all" && r.agentId !== agentFilter) return false;
            return true;
        });
    }, [calls, dateRange, agentFilter]);

    const counts = useMemo(() => ({
        all: scoped.length,
        hot: scoped.filter(c => c.tag === "hot").length,
        cold: scoped.filter(c => c.tag === "cold").length,
        appointment: scoped.filter(c => c.tag === "appointment").length,
        missed: scoped.filter(c => c.tag === "missed").length,
    }), [scoped]);

    const filtered = useMemo(() => scoped.filter(r => {
        if (filter !== "all" && r.tag !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            return r.name.toLowerCase().includes(q) || r.phone.includes(q);
        }
        return true;
    }), [scoped, filter, search]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(c => c.id)));
        }
    };

    const handleRetry = async () => {
        const toCall = filtered.filter(c => selectedIds.has(c.id) && c.phone && c.phone !== "–");
        if (toCall.length === 0) return;
        setRetrying(true);
        setRetryResults(null);
        let success = 0, fail = 0;
        for (const call of toCall) {
            try {
                await makeOutboundCall(call.agentId || "", call.phone);
                success++;
            } catch {
                fail++;
            }
        }
        setRetrying(false);
        setRetryResults({ success, fail });
        setSelectedIds(new Set());
        setTimeout(() => setRetryResults(null), 4000);
    };

    // Contacts view: group filtered calls by phone number
    const contacts = useMemo(() => {
        const map = new Map<string, { phone: string; name: string; calls: CallItem[] }>();
        filtered.forEach(c => {
            const key = c.phone || c.id;
            if (!map.has(key)) map.set(key, { phone: c.phone, name: c.name, calls: [] });
            map.get(key)!.calls.push(c);
        });
        return Array.from(map.values()).sort((a, b) => b.calls.length - a.calls.length);
    }, [filtered]);

    const dateRanges: { id: DateRange; label: string }[] = [
        { id: "all", label: "Tümü" },
        { id: "today", label: "Bugün" },
        { id: "yesterday", label: "Dün" },
        { id: "7d", label: "Son 7 Gün" },
        { id: "30d", label: "Son 30 Gün" },
    ];

    const filters: { id: FilterType; label: React.ReactNode; count: number }[] = [
        { id: "all", label: "Tümü", count: counts.all },
        { id: "appointment", label: <span className="flex items-center gap-1 justify-center"><CalendarCheck className="w-3.5 h-3.5 text-purple-500" /> Randevu</span>, count: counts.appointment },
        { id: "hot", label: <span className="flex items-center gap-1 justify-center"><Flame className="w-3.5 h-3.5 text-orange-500" /> Başarılı</span>, count: counts.hot },
        { id: "cold", label: <span className="flex items-center gap-1 justify-center"><Snowflake className="w-3.5 h-3.5 text-blue-500" /> Başarısız</span>, count: counts.cold },
        { id: "missed", label: <span className="flex items-center gap-1 justify-center"><PhoneMissed className="w-3.5 h-3.5 text-red-500" /> Cevapsız</span>, count: counts.missed },
    ];

    return (
        <div className="min-h-screen p-6 md:p-8 bg-[#FAFAFC] font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                            Çağrı Sonuçları
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Tüm aramaların AI analizlerini, değerlendirme kriterlerini ve toplanan verileri görüntüleyin</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                            <button
                                onClick={() => setViewMode("calls")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    viewMode === "calls" ? "bg-slate-900 text-[#CCFF00]" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <List className="w-3.5 h-3.5" /> Aramalar
                            </button>
                            <button
                                onClick={() => setViewMode("contacts")}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    viewMode === "contacts" ? "bg-slate-900 text-[#CCFF00]" : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <Users className="w-3.5 h-3.5" /> Kişiler
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                                    {contacts.length}
                                </span>
                            </button>
                        </div>
                        <button
                            onClick={fetchCalls}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                            Yenile
                        </button>
                    </div>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id: "total", label: "Toplam Çağrı", value: counts.all, cls: "text-slate-800", icon: <Phone className="w-4 h-4 text-slate-500" /> },
                        { id: "appt", label: "Randevu", value: counts.appointment, cls: "text-purple-600", icon: <CalendarCheck className="w-4 h-4 text-purple-500" /> },
                        { id: "hot", label: "Başarılı", value: counts.hot, cls: "text-orange-600", icon: <Flame className="w-4 h-4 text-orange-500" /> },
                        { id: "cold", label: "Başarısız", value: counts.cold, cls: "text-blue-600", icon: <Snowflake className="w-4 h-4 text-blue-500" /> },
                    ].map(s => (
                        <div key={s.id} className="bg-white rounded-[1.25rem] border border-slate-100 p-4 shadow-sm flex items-center gap-4">
                            <div className="p-2.5 bg-slate-50 rounded-xl shrink-0">{s.icon}</div>
                            <div className="flex flex-col">
                                <h3 className={cn("text-2xl font-bold tracking-tight leading-none", s.cls)}>{s.value}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Date Range + Agent Filter */}
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl flex-wrap">
                            {dateRanges.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDateRange(d.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                        dateRange === d.id
                                            ? "bg-slate-900 text-[#CCFF00]"
                                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                    )}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                            value={agentFilter}
                            onChange={e => setAgentFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none shadow-sm min-w-[200px]"
                        >
                            <option value="all">Tüm Asistanlar</option>
                            {agents.map(a => (
                                <option key={a.agent_id} value={a.agent_id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 placeholder:text-slate-400 shadow-sm"
                            placeholder="İsim veya numara ara..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                        {filters.map(f => (
                            <button key={f.id} onClick={() => setFilter(f.id)}
                                className={cn("flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm border",
                                    filter === f.id
                                        ? "bg-[#ccff00]/10 border-[#ccff00] text-[#8aa300]"
                                        : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-slate-200")}>
                                {f.label}
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                    filter === f.id ? "bg-[#ccff00]/30 text-[#6d8200]" : "bg-slate-100 text-slate-500")}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Contacts View */}
                {viewMode === "contacts" && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            <div className="col-span-4">KİŞİ / NUMARA</div>
                            <div className="col-span-2">TOPLAM ARAMA</div>
                            <div className="col-span-2">SON SONUÇ</div>
                            <div className="col-span-2">SON ARAMA</div>
                            <div className="col-span-2 text-right">TOPLAM SÜRE</div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                                </div>
                            ) : contacts.length === 0 ? (
                                <div className="text-center py-16 text-sm text-slate-400">Hiç kişi bulunamadı.</div>
                            ) : contacts.map(contact => {
                                const lastCall = contact.calls[0];
                                const totalDuration = contact.calls.reduce((s, c) => s + c.duration, 0);
                                const initial = (contact.name && contact.name !== "–" ? contact.name : contact.phone)[0]?.toUpperCase() || "?";
                                return (
                                    <div key={contact.phone}
                                        onClick={() => setSelected(lastCall)}
                                        className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-slate-50/80 cursor-pointer transition-all group">
                                        <div className="col-span-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-[#CCFF00] text-sm flex-shrink-0">
                                                {initial}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">
                                                    {contact.name !== "–" && contact.name !== contact.phone ? contact.name : contact.phone}
                                                </p>
                                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{contact.phone}</p>
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                {contact.calls.length}x
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <TagBadge tag={lastCall.tag} />
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs font-medium text-slate-500">{getTimeAgo(lastCall.time)}</p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm font-bold text-slate-700">
                                                {totalDuration > 0 ? formatDuration(totalDuration) : "–"}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Calls Table */}
                {viewMode === "calls" && <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_5px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="col-span-1 flex items-center">
                            <Checkbox
                                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                                indeterminate={selectedIds.size > 0 && selectedIds.size < filtered.length}
                                onChange={toggleSelectAll}
                            />
                        </div>
                        <div className="col-span-3">KİŞİ / NUMARA</div>
                        <div className="col-span-2">DURUM</div>
                        <div className="col-span-4">AI ÖZETİ</div>
                        <div className="col-span-2 text-right">SÜRE</div>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-16 text-sm text-red-500 font-semibold">{error}</div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-16 text-sm text-slate-400">Hiç kayıt bulunamadı.</div>
                        ) : filtered.map(r => (
                            <div key={r.id}
                                className={cn(
                                    "grid grid-cols-12 gap-4 items-center px-6 py-4 transition-all group",
                                    selectedIds.has(r.id) ? "bg-slate-50" : "hover:bg-slate-50/80"
                                )}>

                                <div className="col-span-1 flex items-center">
                                    <Checkbox
                                        checked={selectedIds.has(r.id)}
                                        onChange={() => toggleSelect(r.id)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>

                                <div className="col-span-3 flex items-center gap-3 cursor-pointer" onClick={() => setSelected(r)}>
                                    {r.tag === "missed" ? (
                                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0"><PhoneMissed className="w-4 h-4 text-red-500" /></div>
                                    ) : r.type === "incoming" ? (
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /></div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0"><ArrowUpRight className="w-4 h-4 text-indigo-600" /></div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{r.name}</p>
                                        <p className="text-[11px] text-slate-400 font-mono tracking-wide mt-0.5">{r.phone}</p>
                                        {(() => {
                                            const agentLabel = r.agentName || agents.find(a => a.agent_id === r.agentId)?.name;
                                            return agentLabel ? (
                                                <p className="text-[10px] text-indigo-500 font-semibold mt-1 flex items-center gap-1">
                                                    <BrainCircuit className="w-2.5 h-2.5" /> {agentLabel}
                                                </p>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>

                                <div className="col-span-2 cursor-pointer" onClick={() => setSelected(r)}>
                                    <TagBadge tag={r.tag} />
                                </div>

                                <div className="col-span-4 cursor-pointer" onClick={() => setSelected(r)}>
                                    <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 w-full group-hover:bg-white group-hover:border-emerald-100 transition-colors">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] font-medium text-slate-600 line-clamp-2 leading-snug">
                                            {r.summary || (r.detailLoaded ? "—" : "Analiz yükleniyor…")}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-span-2 text-right cursor-pointer" onClick={() => setSelected(r)}>
                                    <p className="text-sm font-bold text-slate-700 tabular-nums">{r.duration > 0 ? formatDuration(r.duration) : "–"}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getTimeAgo(r.time)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>}
            </div>

            {/* Floating Retry Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="flex items-center gap-4 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl shadow-slate-900/40 border border-slate-700">
                        <span className="text-sm font-bold">
                            <span className="text-[#CCFF00]">{selectedIds.size}</span> kişi seçildi
                        </span>
                        <div className="w-px h-5 bg-slate-700" />
                        <button
                            onClick={handleRetry}
                            disabled={retrying}
                            className="flex items-center gap-2 px-4 py-2 bg-[#CCFF00] text-slate-900 rounded-xl text-sm font-black hover:brightness-110 transition-all disabled:opacity-60 active:scale-95"
                        >
                            {retrying ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Aranıyor...</>
                            ) : (
                                <><Phone className="w-4 h-4" /> Seçilenleri Ara</>
                            )}
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Retry Result Toast */}
            {retryResults && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold text-slate-800">
                            {retryResults.success} arama başlatıldı
                            {retryResults.fail > 0 && <span className="text-red-500 ml-1">· {retryResults.fail} başarısız</span>}
                        </span>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-lg shadow-sm">
                                    {selected.name && selected.name[0] ? selected.name[0].toUpperCase() : "?"}
                                </div>
                                <div>
                                    <p className="font-bold text-lg text-slate-800 tracking-tight">{selected.name}</p>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{selected.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                            <div className="flex items-center justify-between">
                                <TagBadge tag={selected.tag} />
                                <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {selected.duration > 0 ? formatDuration(selected.duration) : "Cevapsız"}
                                </span>
                            </div>

                            {/* AI Summary */}
                            {selected.summary && (
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-emerald-100/50 rounded-lg">
                                            <Sparkles className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">AI Özeti</span>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{selected.summary}</p>
                                </div>
                            )}

                            {/* Evaluation Criteria Results */}
                            {selected.evaluationResults && selected.evaluationResults.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5" /> Değerlendirme <div className="h-px bg-slate-100 flex-1" />
                                    </h4>
                                    <div className="space-y-2">
                                        {selected.evaluationResults.map(r => (
                                            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
                                                <EvalResultIcon result={r.result} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800">{r.name}</p>
                                                    {r.rationale && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{r.rationale}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}


                            {/* Transcript */}
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5" /> Görüşme Kaydı <div className="h-px bg-slate-100 flex-1" />
                                </h4>
                                {loadingDetail ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                                    </div>
                                ) : detailTranscript.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-4">Transkript bulunamadı.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {detailTranscript.map((m, i) => (
                                            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm border",
                                                    m.role === "agent" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-500 border-slate-200")}>
                                                    {m.role === "agent" ? "AI" : "MÜŞ"}
                                                </div>
                                                <div className={cn("px-4 py-3 rounded-2xl text-[13px] leading-relaxed max-w-[80%] shadow-sm",
                                                    m.role === "agent"
                                                        ? "bg-white border border-slate-100 text-slate-700 rounded-tl-sm"
                                                        : "bg-slate-800 text-white rounded-tr-sm")}>
                                                    {m.text}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
