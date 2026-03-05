import { useEffect, useState } from "react";
import {
    Phone, PhoneMissed, ArrowDownLeft, ArrowUpRight,
    Mic, MicOff, Headphones, Sparkles, Target,
    BarChart3, TrendingUp, ChevronRight, Circle,
    Radio, CheckCircle2, CalendarCheck, Users,
    Zap, Coffee, Lightbulb, Clock,
    X, Play, Pause, Volume2, MessageSquare, Bot, User, Plus
} from "lucide-react";
import { cn, formatDuration, getTimeAgo } from "@/utils/cn";

/* ───── DATA ───── */
const recentCalls = [
    { id: 1, name: "Ahmet Yılmaz", phone: "+90 532 111 22 33", type: "incoming" as const, status: "answered" as const, tag: "hot" as const, duration: 245, time: new Date(Date.now() - 300_000), summary: "Randevu talebi — 15 Mart'a planlandı. Ürün demosu istedi." },
    { id: 2, name: "Elif Demir", phone: "+90 533 222 33 44", type: "outgoing" as const, status: "answered" as const, tag: "warm" as const, duration: 180, time: new Date(Date.now() - 1_200_000), summary: "Kurumsal paket fiyatı iletildi, cuma tekrar arayacak." },
    { id: 3, name: "Bilinmeyen", phone: "+90 534 333 44 55", type: "incoming" as const, status: "missed" as const, tag: "cold" as const, duration: 0, time: new Date(Date.now() - 3_600_000), summary: "Cevapsız — otomatik geri arama kuyruğuna alındı." },
    { id: 4, name: "Mehmet Kaya", phone: "+90 535 444 55 66", type: "outgoing" as const, status: "answered" as const, tag: "hot" as const, duration: 320, time: new Date(Date.now() - 7_200_000), summary: "Ürün tanıtımı tamamlandı, satın alma kararı bekleniyor." },
    { id: 5, name: "Ayşe Çelik", phone: "+90 536 555 66 77", type: "incoming" as const, status: "answered" as const, tag: "cold" as const, duration: 95, time: new Date(Date.now() - 14_400_000), summary: "Şikayet kaydı oluşturuldu, teknik ekibe iletildi." },
];

const INITIAL_CALL_QUEUE = [
    { id: 101, name: "Caner Yılmaz", phone: "+90 541 111 22 33", scheduledFor: new Date(Date.now() + 5 * 60_000), reason: "Daha sonra ara denildi (Dün)" },
    { id: 102, name: "Zeynep Arslan", phone: "+90 542 222 33 44", scheduledFor: new Date(Date.now() + 25 * 60_000), reason: "Randevu teyidi" },
    { id: 103, name: "Burak Kaya", phone: "+90 543 333 44 55", scheduledFor: new Date(Date.now() + 60 * 60_000), reason: "Yeni liste taraması" },
    { id: 104, name: "Elif Demir", phone: "+90 544 444 55 66", scheduledFor: new Date(Date.now() + 120 * 60_000), reason: "Ulaşılamadı (2. deneme)" },
];

const performances = [
    { label: "Müşteri Memnuniyeti", value: 94 },
    { label: "Çağrı Çözümleme", value: 87 },
    { label: "Randevu Dönüşümü", value: 72 },
    { label: "Sıcak Lead Oranı", value: 63 },
];

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
    if (tag === "hot") return <span className="badge-hot">🔥 Sıcak</span>;
    if (tag === "warm") return <span className="badge-warm">♻ Ilık</span>;
    return <span className="badge-cold">❄ Soğuk</span>;
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
    const [selectedCall, setSelectedCall] = useState<any | null>(null);
    const [localCallQueue, setLocalCallQueue] = useState(INITIAL_CALL_QUEUE);
    const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
    const [newCallForm, setNewCallForm] = useState({ name: "", phone: "", reason: "" });

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

        setLocalCallQueue(prev => [newItem, ...prev]);
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
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                                <div className="w-4 h-1 rounded-full bg-slate-900"></div>
                                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-900 shadow-md flex items-center justify-center">
                                <Coffee className="w-4 h-4 text-[#CCFF00]" />
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-6">LUERA</p>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5 mb-1">
                                {greeting}, Furkan <span className="text-xl">👋</span>
                            </h3>
                            <p className="text-xs font-medium text-gray-400">AI asistanınız aktif çalışıyor</p>
                        </div>
                    </div>

                    {/* Card 2: System Status */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                                <div className="w-4 h-1 rounded-full bg-slate-900"></div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-900 shadow-md flex items-center justify-center">
                                <Radio className="w-4 h-4 text-[#CCFF00]" />
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-6">SİSTEM DURUMU</p>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">Kuyruk Aktif</h3>
                            <p className="text-xs font-medium text-gray-400">Arka planda {localCallQueue.length} numara bekliyor</p>
                        </div>
                    </div>

                    {/* Card 3: Test Button */}
                    <button
                        onClick={() => setIsNewCallModalOpen(true)}
                        className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-lg shadow-slate-900/20 relative overflow-hidden flex flex-col justify-between min-h-[140px] group hover:scale-[1.02] hover:shadow-xl hover:shadow-[#CCFF00]/10 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-[#CCFF00]"
                    >
                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00]/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#CCFF00]/20 transition-all duration-500 pointer-events-none"></div>

                        <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5">
                            <div className="flex gap-1 group-hover:opacity-0 transition-opacity duration-300 absolute top-0 right-12">
                                <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                                <div className="w-4 h-1 rounded-full bg-[#CCFF00] shadow-[0_0_5px_rgba(204,255,0,0.5)]"></div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.4)] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <Play className="w-5 h-5 text-slate-900 fill-slate-900 ml-0.5" />
                            </div>
                        </div>

                        <p className="text-[11px] font-bold text-[#CCFF00] tracking-widest uppercase mb-6 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> DEMO
                        </p>

                        <div className="relative z-10">
                            <h3 className="text-xl font-bold text-white tracking-tight mb-1">Test Araması Başlat</h3>
                            <p className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">AI asistanı hemen test edin</p>
                        </div>
                    </button>

                    {/* Card 4: Appointments */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                        <div className="absolute top-4 right-4 flex flex-col items-center gap-1.5">
                            <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                                <div className="w-4 h-1 rounded-full bg-slate-900"></div>
                                <div className="w-1 h-1 rounded-full bg-gray-300"></div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-900 shadow-md flex items-center justify-center">
                                <CalendarCheck className="w-4 h-4 text-[#CCFF00]" />
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-6">RANDEVU</p>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1">12 randevu alındı</h3>
                            <p className="text-xs font-bold text-blue-500 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> %45 dönüşüm oranı</p>
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
                                                {activeTab === "past" ? recentCalls.length : localCallQueue.length}
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

                                        <button
                                            onClick={() => setIsNewCallModalOpen(true)}
                                            className="flex items-center gap-2 bg-slate-900 text-[#CCFF00] px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:shadow-slate-900/20 hover:-translate-y-0.5 transition-all w-full sm:w-auto justify-center group"
                                        >
                                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /> Yeni Arama
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 md:p-6 bg-gray-50/50 rounded-b-2xl">
                                <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-2 custom-scrollbar">
                                    {activeTab === "past" ? (
                                        recentCalls.map((call) => (
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
                                    ) : (
                                        localCallQueue.map((item) => (
                                            <div key={item.id}
                                                className="flex items-center gap-5 p-5 bg-white border border-gray-100 rounded-2xl hover:border-[#CCFF00]/50 transition-all shadow-sm hover:shadow-md cursor-pointer group">

                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                    <CalendarCheck className="w-5 h-5 text-[#CCFF00]" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3 mb-1.5">
                                                        <p className="text-base font-bold text-gray-900 truncate">{item.name}</p>
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-100 uppercase tracking-widest">
                                                            Bekliyor
                                                        </span>
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
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20" onClick={(e) => e.stopPropagation()}>

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
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-gray-50/30 custom-scrollbar">

                            {/* Audio Player Card */}
                            <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#CCFF00]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none transition-transform group-hover:scale-110 duration-700"></div>
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-[#CCFF00]" /> Görüşme Kaydı (Retell AI)
                                </h3>
                                <div className="flex items-center gap-6 relative z-10">
                                    <button className="w-14 h-14 flex-shrink-0 rounded-full bg-[#CCFF00] text-slate-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-[#CCFF00]/20">
                                        <Play className="w-6 h-6 ml-1" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        {/* Fake Waveform */}
                                        <div className="flex items-center gap-1 h-10 w-full opacity-60">
                                            {Array.from({ length: 60 }).map((_, i) => {
                                                const height = 20 + Math.random() * 80;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex-1 bg-white rounded-full transition-all duration-300 hover:bg-[#CCFF00] hover:h-full cursor-pointer"
                                                        style={{ height: `${height}%`, opacity: Math.random() * 0.5 + 0.3 }}
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
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md">
                                            <Bot className="w-5 h-5 text-[#CCFF00]" />
                                        </div>
                                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-4 text-sm text-gray-800 font-medium max-w-[85%] leading-relaxed border border-gray-200/50">
                                            Merhaba {selectedCall.name}, ben LUERA. Dünkü görüşmemize istinaden sizi arıyorum. Nasılsınız?
                                        </div>
                                    </div>

                                    <div className="flex gap-4 flex-row-reverse">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm p-4 text-sm font-medium max-w-[85%] shadow-md leading-relaxed">
                                            İyiyim teşekkürler. Evet paketlerinizi inceledim. Fiyatlar biraz yüksek geldi ama içeriği çok beğendim.
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-md">
                                            <Bot className="w-5 h-5 text-[#CCFF00]" />
                                        </div>
                                        <div className="bg-gray-100 rounded-2xl rounded-tl-sm p-4 text-sm text-gray-800 font-medium max-w-[85%] leading-relaxed border border-gray-200/50">
                                            Anlıyorum. İçeriği beğenmeniz harika. Eğer isterseniz, bütçenize daha uygun olan Başlangıç paketimizi size detaylıca anlatabilirim. Ne dersiniz?
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── NEW CALL MODAL (ADD TO QUEUE) ── */}
            {isNewCallModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white md:rounded-[2rem] shadow-2xl w-full h-full md:h-[calc(100vh-2rem)] overflow-hidden flex flex-col ring-1 ring-white/20" onClick={(e) => e.stopPropagation()}>

                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative z-10 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-slate-900 text-[#CCFF00] flex items-center justify-center shadow-md">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Canlı AI Testi</h2>
                                    <p className="text-xs text-gray-500 mt-1">Sisteminizin yapay zekasını gerçek zamanlı olarak test edin.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsNewCallModalOpen(false)}
                                className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 hover:text-red-500 text-gray-400 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex flex-1 bg-slate-50 relative overflow-hidden">
                            {/* Left Side: Voice Orb & Controls */}
                            <div className="w-1/2 p-8 border-r border-gray-100 flex flex-col items-center justify-center relative bg-white">
                                <div className="absolute top-6 left-6 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> Live Audio
                                </div>

                                {/* Orb Container */}
                                <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                                    {/* Pulsing rings */}
                                    <div className="absolute inset-0 rounded-full border border-[#CCFF00]/30 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                                    <div className="absolute inset-4 rounded-full border border-[#CCFF00]/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>

                                    {/* Core */}
                                    <div className="relative z-10 w-28 h-28 rounded-full bg-slate-900 shadow-[0_0_50px_rgba(204,255,0,0.3)] flex items-center justify-center transition-transform hover:scale-105 duration-300">
                                        <Mic className="w-10 h-10 text-[#CCFF00]" />
                                    </div>
                                    <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-[#CCFF00] to-transparent opacity-20 blur-xl"></div>
                                </div>

                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-bold text-slate-900">Dinleniyor...</h3>
                                    <p className="text-sm text-gray-500 max-w-[200px]">Konuşarak yapay zeka ile etkileşime geçebilirsiniz.</p>
                                </div>

                                {/* Call Controls */}
                                <div className="absolute bottom-6 flex items-center gap-3">
                                    <button className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-slate-700 flex items-center justify-center transition-all">
                                        <MicOff className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setIsNewCallModalOpen(false)}
                                        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 flex items-center justify-center transition-all hover:scale-105"
                                    >
                                        <Phone className="w-6 h-6 rotate-135" style={{ transform: 'rotate(135deg)' }} />
                                    </button>
                                </div>
                            </div>

                            {/* Right Side: Transcription */}
                            <div className="w-1/2 bg-gray-50 flex flex-col items-center justify-between p-6">
                                <div className="w-full flex justify-between items-center mb-6">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Live Transcript
                                    </h3>
                                    <span className="text-xs font-mono font-medium text-gray-400 bg-gray-200/50 px-2 py-1 rounded">00:15</span>
                                </div>

                                {/* Chat View */}
                                <div className="flex-1 w-full overflow-y-auto pr-2 space-y-6 custom-scrollbar mb-4 flex flex-col justify-end">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span className="text-[10px] font-bold text-slate-400 ml-2">LUERA AI</span>
                                        <div className="bg-white border border-gray-100/50 rounded-2xl p-4 text-sm text-slate-800 shadow-sm leading-relaxed max-w-[95%]">
                                            Merhaba! Ben LUERA, size nasıl yardımcı olabilirim? Herhangi bir kampanya oluşturmak ister misiniz?
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 items-end">
                                        <span className="text-[10px] font-bold text-slate-400 mr-2">SİZ</span>
                                        <div className="bg-slate-900 text-white rounded-2xl p-4 text-sm shadow-md leading-relaxed max-w-[95%] border border-slate-800">
                                            Evet, yeni bir randevu alabilir miyiz Cuma gününe?
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1 items-start">
                                        <span className="text-[10px] items-center flex gap-1 font-bold text-[#bfff00] ml-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse"></div>
                                            LUERA AI YAZIYOR...
                                        </span>
                                    </div>
                                </div>

                                {/* Settings/Meta box at the bottom */}
                                <div className="w-full bg-white border border-gray-200/60 rounded-xl p-3 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <Zap className="w-3.5 h-3.5" />
                                        </div>
                                        <span>Gecikme: <span className="text-emerald-600 font-bold">120ms</span></span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                        Model: <span className="font-bold text-slate-700">Claude 3.5 Sonnet</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

// Keep existing sub-components hooks below...
