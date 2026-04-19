import { useEffect, useMemo, useState } from "react";
import {
    BarChart3, Coins, Clock, Mic, Loader2, AlertCircle,
    Calendar, TrendingUp, RefreshCw,
} from "lucide-react";
import {
    getUserSubscription, getCharacterUsage,
    UserSubscription, CharacterUsageStats,
    CHAR_RATE_TRY, CHARS_PER_MINUTE,
} from "@/services/elevenlabsApi";
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { cn } from "@/utils/cn";

const formatNumber = (n: number) => n.toLocaleString("tr-TR");
const formatTRY = (n: number) =>
    n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 });

const formatDate = (unixSecs: number) =>
    new Date(unixSecs * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

const tierLabel = (tier: string) => {
    const map: Record<string, string> = {
        free: "Free", starter: "Starter", creator: "Creator",
        pro: "Pro", scale: "Scale", business: "Business",
    };
    return map[tier?.toLowerCase()] || tier || "—";
};

export const UsagePage = () => {
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [stats, setStats] = useState<CharacterUsageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [sub, usage] = await Promise.all([
                getUserSubscription(),
                getCharacterUsage().catch(() => ({ time: [], usage: {} } as CharacterUsageStats)),
            ]);
            setSubscription(sub);
            setStats(usage);
        } catch (err: any) {
            setError(err.message || "Kullanım verisi alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // Build daily chart data from stats
    const chartData = useMemo(() => {
        if (!stats || !stats.time || stats.time.length === 0) return [];
        const totals = new Array(stats.time.length).fill(0);
        Object.values(stats.usage || {}).forEach(arr => {
            arr.forEach((v, i) => { totals[i] = (totals[i] || 0) + (v || 0); });
        });
        return stats.time.map((t, i) => ({
            day: new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }),
            chars: totals[i],
            minutes: Math.round((totals[i] / CHARS_PER_MINUTE) * 10) / 10,
            try: Math.round(totals[i] * CHAR_RATE_TRY * 100) / 100,
        }));
    }, [stats]);

    const usedPct = subscription && subscription.character_limit > 0
        ? Math.min(100, Math.round((subscription.character_count / subscription.character_limit) * 100))
        : 0;

    const periodTotal = useMemo(() => chartData.reduce((s, d) => s + d.chars, 0), [chartData]);
    const periodMinutes = periodTotal / CHARS_PER_MINUTE;
    const periodCost = periodTotal * CHAR_RATE_TRY;

    const quotaColor = usedPct >= 90 ? "bg-red-500" : usedPct >= 75 ? "bg-amber-500" : "bg-emerald-500";

    return (
        <div className="w-full min-h-screen p-4 md:p-8 pb-32 bg-[#F8FAFC]">
            <div className="max-w-[1400px] w-full mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 text-slate-500 mb-2">
                            <div className="p-2 rounded-xl bg-slate-900 text-[#CCFF00] shadow-[0_0_20px_rgba(204,255,0,0.2)]">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.25em]">KULLANIM PANELİ</span>
                        </div>
                        <h1 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight">
                            Aylık <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-[#9acc00]">Kullanım & Maliyet</span>
                        </h1>
                        <p className="text-slate-500 text-sm font-medium mt-2 max-w-2xl">
                            Karakter kotanı, konuşma dakikalarını ve tahmini TL maliyetini takip et. Fatura ay sonunda toplam kullanıma göre kesilir.
                        </p>
                    </div>
                    <button
                        onClick={fetchAll}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Yenile
                    </button>
                </div>

                {loading && !subscription ? (
                    <div className="flex items-center justify-center py-32">
                        <Loader2 className="w-10 h-10 text-[#CCFF00] animate-spin" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                            <h3 className="font-black text-red-900 mb-1">Kullanım verisi alınamadı</h3>
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                        <Mic className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bu Dönem</span>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tracking-tight">{formatNumber(subscription?.character_count || 0)}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1">Karakter kullanıldı</p>
                            </div>

                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-sky-600" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tahmini</span>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tracking-tight">
                                    {Math.round((subscription?.character_count || 0) / CHARS_PER_MINUTE)}
                                    <span className="text-base text-slate-400 ml-1 font-bold">dk</span>
                                </p>
                                <p className="text-xs font-bold text-slate-500 mt-1">Konuşma süresi</p>
                            </div>

                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                        <Coins className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tahmini Fatura</span>
                                </div>
                                <p className="text-3xl font-black text-slate-900 tracking-tight">
                                    {formatTRY((subscription?.character_count || 0) * CHAR_RATE_TRY)}
                                </p>
                                <p className="text-xs font-bold text-slate-500 mt-1">
                                    ₺{CHAR_RATE_TRY.toFixed(4)} × karakter
                                </p>
                            </div>

                            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#CCFF00]/20 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-[#CCFF00]" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Plan</span>
                                </div>
                                <p className="text-2xl font-black text-white tracking-tight">{tierLabel(subscription?.tier || "")}</p>
                                <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {subscription?.next_character_count_reset_unix
                                        ? `Sıfırlanma: ${formatDate(subscription.next_character_count_reset_unix)}`
                                        : "—"}
                                </p>
                            </div>
                        </div>

                        {/* Quota Bar */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Karakter Kotası</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        ElevenLabs aboneliğinin dönem limiti
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-black text-slate-900">%{usedPct}</p>
                                    <p className="text-[11px] font-bold text-slate-500 font-mono">
                                        {formatNumber(subscription?.character_count || 0)} / {formatNumber(subscription?.character_limit || 0)}
                                    </p>
                                </div>
                            </div>
                            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all duration-1000", quotaColor)}
                                    style={{ width: `${usedPct}%` }}
                                />
                            </div>
                            {usedPct >= 75 && (
                                <p className={cn(
                                    "text-xs font-bold mt-3 flex items-center gap-1.5",
                                    usedPct >= 90 ? "text-red-600" : "text-amber-600"
                                )}>
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {usedPct >= 90 ? "Kota neredeyse dolu — yakında aramalar kesilebilir." : "Kotanın %75'i kullanıldı."}
                                </p>
                            )}
                        </div>

                        {/* Daily chart */}
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Son 30 Gün</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Günlük karakter kullanımı</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <div>
                                        <span className="text-slate-400">Toplam:</span>{" "}
                                        <span className="text-slate-900">{formatNumber(periodTotal)} karakter</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">≈</span>{" "}
                                        <span className="text-slate-900">{Math.round(periodMinutes)} dk</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">≈</span>{" "}
                                        <span className="text-emerald-600">{formatTRY(periodCost)}</span>
                                    </div>
                                </div>
                            </div>

                            {chartData.length === 0 ? (
                                <div className="h-64 flex items-center justify-center text-sm text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    Bu dönem için kullanım verisi yok.
                                </div>
                            ) : (
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="chars" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#CCFF00" stopOpacity={0.5} />
                                                    <stop offset="100%" stopColor="#CCFF00" stopOpacity={0.05} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                                            <Tooltip
                                                contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12 }}
                                                formatter={(value: any, name: string) => {
                                                    if (name === "chars") return [`${formatNumber(value)} karakter`, "Kullanım"];
                                                    return [value, name];
                                                }}
                                            />
                                            <Area type="monotone" dataKey="chars" stroke="#84cc16" strokeWidth={2} fill="url(#chars)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-slate-400 text-center mt-6">
                            Tahmini TL değerleri <span className="font-mono font-bold">VITE_CHAR_RATE_TRY={CHAR_RATE_TRY}</span> kabul edilerek hesaplanır. Gerçek fatura ay sonunda kesilir.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
