import { useState } from "react";
import {
    Search, Phone, ArrowDownLeft, ArrowUpRight, PhoneMissed,
    Sparkles, Clock, ChevronRight, X, Flame, Snowflake,
    CalendarCheck, Filter, MoreVertical, MessageSquare
} from "lucide-react";
import { cn, formatDuration, getTimeAgo } from "@/utils/cn";

type Tag = "hot" | "cold" | "appointment" | "missed";
type FilterType = "all" | Tag;

const results = [
    { id: 1, name: "Ahmet Yılmaz", phone: "+90 532 111 22 33", type: "incoming" as const, duration: 245, time: new Date(Date.now() - 300_000), tag: "hot" as Tag, summary: "Randevu talebi var. 15 Mart öğleden sonrasını tercih ediyor. Çok ilgili.", wa: true },
    { id: 2, name: "Elif Demir", phone: "+90 533 222 33 44", type: "outgoing" as const, duration: 180, time: new Date(Date.now() - 1_200_000), tag: "appointment" as Tag, summary: "Kurumsal paket ilgisini çekti. Randevu verildi: 5 Mart 14:00.", wa: true },
    { id: 3, name: "Bilinmeyen", phone: "+90 534 333 44 55", type: "incoming" as const, duration: 0, time: new Date(Date.now() - 3_600_000), tag: "missed" as Tag, summary: "Cevapsız çağrı. Geri arama kuyruğuna alındı.", wa: false },
    { id: 4, name: "Mehmet Kaya", phone: "+90 535 444 55 66", type: "outgoing" as const, duration: 320, time: new Date(Date.now() - 7_200_000), tag: "hot" as Tag, summary: "Demo talep etti. Satın alma eğilimi yüksek görünüyor.", wa: true },
    { id: 5, name: "Ayşe Çelik", phone: "+90 536 555 66 77", type: "incoming" as const, duration: 95, time: new Date(Date.now() - 14_400_000), tag: "cold" as Tag, summary: "Şimdilik ilgilenmediğini belirtti. 3 ay sonra tekrar aranacak.", wa: false },
    { id: 6, name: "Fatma Öztürk", phone: "+90 537 666 77 88", type: "outgoing" as const, duration: 410, time: new Date(Date.now() - 28_800_000), tag: "appointment" as Tag, summary: "Uzun görüşme. Randevu alındı: 7 Mart 10:00. Çok memnun.", wa: true },
    { id: 7, name: "Ali Arslan", phone: "+90 538 777 88 99", type: "incoming" as const, duration: 0, time: new Date(Date.now() - 43_200_000), tag: "missed" as Tag, summary: "Mesai dışı arama. Geri bildirim bekleniyor.", wa: false },
    { id: 8, name: "Zeynep Yıldız", phone: "+90 539 888 99 00", type: "incoming" as const, duration: 156, time: new Date(Date.now() - 57_600_000), tag: "hot" as Tag, summary: "Ürün demo istedi. Premium paketi tercih edebilir.", wa: true },
    { id: 9, name: "Hakan Eren", phone: "+90 531 999 00 11", type: "outgoing" as const, duration: 278, time: new Date(Date.now() - 72_000_000), tag: "cold" as Tag, summary: "Bütçe uygun değil bu dönem. 6 ay sonra tekrar.", wa: false },
    { id: 10, name: "Selin Aksoy", phone: "+90 532 000 11 22", type: "incoming" as const, duration: 89, time: new Date(Date.now() - 86_400_000), tag: "appointment" as Tag, summary: "Randevu verildi: 10 Mart 15:30. Çok ilgili ve nazik.", wa: true },
];

const TagBadge = ({ tag }: { tag: Tag }) => {
    if (tag === "hot") return <span className="badge-hot"><Flame className="w-3 h-3" />Sıcak</span>;
    if (tag === "cold") return <span className="badge-cold"><Snowflake className="w-3 h-3" />Soğuk</span>;
    if (tag === "appointment") return <span className="badge-appointment"><CalendarCheck className="w-3 h-3" />Randevu</span>;
    return <span className="badge-missed">Cevapsız</span>;
};

export const ResultsPage = () => {
    const [filter, setFilter] = useState<FilterType>("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<typeof results[0] | null>(null);

    const filtered = results.filter(r => {
        if (filter !== "all" && r.tag !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            return r.name.toLowerCase().includes(q) || r.phone.includes(q);
        }
        return true;
    });

    const counts = {
        all: results.length,
        hot: results.filter(r => r.tag === "hot").length,
        cold: results.filter(r => r.tag === "cold").length,
        appointment: results.filter(r => r.tag === "appointment").length,
        missed: results.filter(r => r.tag === "missed").length,
    };

    const filters: { id: FilterType; label: string; count: number }[] = [
        { id: "all", label: "Tümü", count: counts.all },
        { id: "hot", label: "🔥 Sıcak", count: counts.hot },
        { id: "cold", label: "❄ Soğuk", count: counts.cold },
        { id: "appointment", label: "📅 Randevu", count: counts.appointment },
        { id: "missed", label: "Cevapsız", count: counts.missed },
    ];

    return (
        <div className="min-h-screen p-6 md:p-8" style={{ background: "linear-gradient(160deg,#f5f3ff 0%,#faf9ff 40%,#f0fdf4 100%)" }}>
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                        Çağrı Sonuçları
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Tüm aramaların sonuçlarını, AI özetlerini ve etiketleri görüntüleyin</p>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: "Toplam", value: counts.all, cls: "text-gray-900" },
                        { label: "🔥 Sıcak", value: counts.hot, cls: "text-red-600" },
                        { label: "📅 Randevu", value: counts.appointment, cls: "text-emerald-600" },
                        { label: "❄ Soğuk", value: counts.cold, cls: "text-blue-600" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 card text-center">
                            <p className={cn("text-3xl font-bold", s.cls)}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            className="input-base pl-10"
                            placeholder="İsim veya numara ara..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {filters.map(f => (
                            <button key={f.id} onClick={() => setFilter(f.id)}
                                className={cn("flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                                    filter === f.id
                                        ? "bg-[#0f0f14] text-white shadow-sm"
                                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>
                                {f.label}
                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                    filter === f.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500")}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-3xl overflow-hidden card">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-gray-50/80 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        <div className="col-span-3">Kişi</div>
                        <div className="col-span-2">Etiket</div>
                        <div className="col-span-5">AI Özeti</div>
                        <div className="col-span-1 text-center">WA</div>
                        <div className="col-span-1 text-right">Süre</div>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {filtered.map(r => (
                            <div key={r.id}
                                onClick={() => setSelected(r)}
                                className="grid grid-cols-12 gap-3 items-center px-6 py-4 hover:bg-gray-50/80 cursor-pointer transition-colors group">

                                <div className="col-span-3 flex items-center gap-2.5">
                                    {r.tag === "missed" ? (
                                        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"><PhoneMissed className="w-3.5 h-3.5 text-red-500" /></div>
                                    ) : r.type === "incoming" ? (
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /></div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center"><ArrowUpRight className="w-3.5 h-3.5 text-gray-900" /></div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-900 truncate">{r.name}</p>
                                        <p className="text-[10px] text-gray-400 font-mono">{r.phone}</p>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <TagBadge tag={r.tag} />
                                </div>

                                <div className="col-span-5">
                                    <div className="flex items-start gap-1.5 bg-gray-900/60 border border-gray-200/50 rounded-xl px-2.5 py-1.5">
                                        <Sparkles className="w-3 h-3 text-gray-900 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-gray-600 line-clamp-1">{r.summary}</p>
                                    </div>
                                </div>

                                <div className="col-span-1 flex justify-center">
                                    {r.wa ? (
                                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <span className="w-4 h-4 flex items-center justify-center text-slate-300">–</span>
                                    )}
                                </div>

                                <div className="col-span-1 text-right">
                                    <p className="text-xs font-semibold text-gray-700">{r.duration > 0 ? formatDuration(r.duration) : "–"}</p>
                                    <p className="text-[9px] text-gray-400">{getTimeAgo(r.time)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-fadeInUp">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                                    style={{ background: "linear-gradient(135deg,#0f0f14,#0f0f14)" }}>
                                    {selected.name !== "Bilinmeyen" ? selected.name[0] : "?"}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{selected.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{selected.phone}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <TagBadge tag={selected.tag} />
                                <span className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {selected.duration > 0 ? formatDuration(selected.duration) : "Cevapsız"}
                                </span>
                            </div>

                            <div className="bg-gray-900 border border-gray-200 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-gray-900" />
                                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">AI Özeti</span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">{selected.summary}</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Yapay Zeka Transkripti</p>
                                <div className="space-y-3">
                                    {[
                                        { role: "ai", text: "Merhaba, LUERA'ya hoş geldiniz. Size nasıl yardımcı olabilirim?" },
                                        { role: "caller", text: "Merhaba, randevu almak istiyorum." },
                                        { role: "ai", text: "Tabii, size yardımcı olabilirim. Hangi saat aralığını tercih edersiniz?" },
                                    ].map((m, i) => (
                                        <div key={i} className={cn("flex gap-2", m.role === "caller" && "flex-row-reverse")}>
                                            <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                                                m.role === "ai" ? "bg-gray-900 text-gray-900" : "bg-gray-200 text-gray-600")}>
                                                {m.role === "ai" ? "AI" : "MÜ"}
                                            </div>
                                            <div className={cn("max-w-[75%] px-3 py-2 rounded-xl text-xs",
                                                m.role === "ai" ? "bg-white border border-gray-200 text-gray-700" : "bg-gray-900 text-gray-900")}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                {selected.tag !== "appointment" && (
                                    <button className="flex-1 py-3 rounded-2xl btn-primary text-sm flex items-center justify-center gap-2">
                                        <CalendarCheck className="w-4 h-4" /> Randevu Al
                                    </button>
                                )}
                                <button className="flex-1 py-3 rounded-2xl border border-emerald-200 text-emerald-700 text-sm font-semibold bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> WhatsApp Gönder
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
