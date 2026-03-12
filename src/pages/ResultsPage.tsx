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

    const filters: { id: FilterType; label: React.ReactNode; count: number }[] = [
        { id: "all", label: "Tümü", count: counts.all },
        { id: "hot", label: <span className="flex items-center gap-1 justify-center"><Flame className="w-3.5 h-3.5 text-orange-500" /> Sıcak</span>, count: counts.hot },
        { id: "cold", label: <span className="flex items-center gap-1 justify-center"><Snowflake className="w-3.5 h-3.5 text-blue-500" /> Soğuk</span>, count: counts.cold },
        { id: "appointment", label: <span className="flex items-center gap-1 justify-center"><CalendarCheck className="w-3.5 h-3.5 text-purple-500" /> Randevu</span>, count: counts.appointment },
        { id: "missed", label: <span className="flex items-center gap-1 justify-center"><PhoneMissed className="w-3.5 h-3.5 text-red-500" /> Cevapsız</span>, count: counts.missed },
    ];

    return (
        <div className="min-h-screen p-6 md:p-8 bg-[#FAFAFC] font-sans">
            <div className="max-w-[1200px] mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                        Çağrı Sonuçları
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Tüm aramaların sonuçlarını, AI özetlerini ve etiketleri görüntüleyin</p>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id: "total", label: "Toplam Çağrı", value: counts.all, cls: "text-slate-800", icon: <Phone className="w-4 h-4 text-slate-500" /> },
                        { id: "hot", label: "Sıcak Fırsat", value: counts.hot, cls: "text-orange-600", icon: <Flame className="w-4 h-4 text-orange-500" /> },
                        { id: "appt", label: "Alınan Randevu", value: counts.appointment, cls: "text-emerald-600", icon: <CalendarCheck className="w-4 h-4 text-emerald-500" /> },
                        { id: "cold", label: "Soğuk / İlgisiz", value: counts.cold, cls: "text-blue-600", icon: <Snowflake className="w-4 h-4 text-blue-500" /> },
                    ].map(s => (
                        <div key={s.id} className="bg-white rounded-[1.25rem] border border-slate-100 p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex items-center gap-4">
                            <div className="p-2.5 bg-slate-50 rounded-xl group-hover:scale-110 group-hover:bg-slate-100 transition-all shrink-0">
                                {s.icon}
                            </div>
                            <div className="flex flex-col">
                                <h3 className={cn("text-2xl font-bold tracking-tight leading-none", s.cls)}>{s.value}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400 shadow-sm"
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
                                        ? "bg-[#ccff00]/10 border-[#ccff00] text-[#8aa300] shadow-[0_0_15px_rgba(204,255,0,0.2)]"
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

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_5px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="col-span-3">KİŞİ / NUMARA</div>
                        <div className="col-span-2">DURUM ETİKETİ</div>
                        <div className="col-span-5">LUNA ÖZETİ</div>
                        <div className="col-span-1 text-center">WA</div>
                        <div className="col-span-1 text-right">SÜRE</div>
                    </div>

                    <div className="divide-y divide-slate-50">
                        {filtered.map(r => (
                            <div key={r.id}
                                onClick={() => setSelected(r)}
                                className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-slate-50/80 cursor-pointer transition-all group">

                                <div className="col-span-3 flex items-center gap-3">
                                    {r.tag === "missed" ? (
                                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0"><PhoneMissed className="w-4 h-4 text-red-500" /></div>
                                    ) : r.type === "incoming" ? (
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /></div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0"><ArrowUpRight className="w-4 h-4 text-indigo-600" /></div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">{r.name}</p>
                                        <p className="text-[11px] text-slate-400 font-mono tracking-wide mt-0.5">{r.phone}</p>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <TagBadge tag={r.tag} />
                                </div>

                                <div className="col-span-5">
                                    <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 w-full max-w-sm group-hover:bg-white group-hover:border-emerald-100 transition-colors shadow-sm">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-[11px] font-medium text-slate-600 line-clamp-1 leading-snug">{r.summary}</p>
                                    </div>
                                </div>

                                <div className="col-span-1 flex justify-center">
                                    {r.wa ? (
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-emerald-500" /></div>
                                    ) : (
                                        <span className="text-slate-300 font-bold">–</span>
                                    )}
                                </div>

                                <div className="col-span-1 text-right">
                                    <p className="text-sm font-bold text-slate-700 tabular-nums">{r.duration > 0 ? formatDuration(r.duration) : "–"}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getTimeAgo(r.time)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-600 text-lg shadow-sm">
                                    {selected.name !== "Bilinmeyen" ? selected.name[0] : "?"}
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

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                            {/* Tags & Time */}
                            <div className="flex items-center justify-between">
                                <TagBadge tag={selected.tag} />
                                <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {selected.duration > 0 ? formatDuration(selected.duration) : "Cevapsız"}
                                </span>
                            </div>

                            {/* AI Summary Highlight */}
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 shadow-[0_4px_15px_rgba(16,185,129,0.03)]">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-1.5 bg-emerald-100/50 rounded-lg">
                                        <Sparkles className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">LUNA Özeti</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed font-medium">{selected.summary}</p>
                            </div>

                            {/* Transcript Area */}
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                                    Görüşme Kaydı <div className="h-px bg-slate-100 flex-1" />
                                </h4>
                                <div className="space-y-4">
                                    {[
                                        { role: "ai", text: "Merhaba, ben LUNA. Size nasıl yardımcı olabilirim?" },
                                        { role: "caller", text: "Merhaba, randevu almak istiyorum." },
                                        { role: "ai", text: "Tabii, size yardımcı olabilirim. Hangi saat aralığını tercih edersiniz?" },
                                    ].map((m, i) => (
                                        <div key={i} className={cn("flex gap-3", m.role === "caller" && "flex-row-reverse")}>
                                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-sm border",
                                                m.role === "ai" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-white text-slate-500 border-slate-200")}>
                                                {m.role === "ai" ? "LUNA" : "MÜŞ"}
                                            </div>
                                            <div className={cn("px-4 py-3 rounded-2xl text-[13px] leading-relaxed max-w-[80%] shadow-sm",
                                                m.role === "ai"
                                                    ? "bg-white border border-slate-100 text-slate-700 rounded-tl-sm"
                                                    : "bg-slate-800 text-white rounded-tr-sm")}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-3 shrink-0">
                            {selected.tag !== "appointment" && (
                                <button className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2">
                                    <CalendarCheck className="w-4 h-4" /> Randevu Al
                                </button>
                            )}
                            <button className="flex-1 py-3 px-4 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-bold bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors backdrop-blur-sm flex items-center justify-center gap-2 shadow-sm">
                                <MessageSquare className="w-4 h-4" /> WhatsApp Gönder
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
