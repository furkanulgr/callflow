import { useState } from "react";
import {
    ChevronLeft, ChevronRight, CalendarDays, Clock,
    Phone, User, Plus, X, CheckCircle2, Flame
} from "lucide-react";
import { cn } from "@/utils/cn";

// We will use the same Queue format to match the "Bekleyen Kuyruk" concept
const appointments = [
    { id: 1, name: "Caner Yılmaz", phone: "+90 541 111 22 33", date: "2026-03-01", time: "14:00", tag: "hot", note: "Daha sonra ara denildi (Dün)" },
    { id: 2, name: "Zeynep Arslan", phone: "+90 542 222 33 44", date: "2026-03-01", time: "11:00", tag: "warm", note: "Randevu teyidi" },
    { id: 3, name: "Fatma Öztürk", phone: "+90 537 666 77 88", date: "2026-03-07", time: "10:00", tag: "hot", note: "Sözleşme onayı" },
    { id: 4, name: "Selin Aksoy", phone: "+90 532 000 11 22", date: "2026-03-10", time: "15:30", tag: "warm", note: "İkinci görüşme" },
    { id: 5, name: "Burak Kaya", phone: "+90 543 333 44 55", date: "2026-03-12", time: "09:00", tag: "hot", note: "Yeni liste taraması" },
    { id: 6, name: "Elif Demir", phone: "+90 544 444 55 66", date: "2026-03-02", time: "16:00", tag: "warm", note: "Ulaşılamadı (2. deneme)" },
];

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
    return (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
}

export const CalendarPage = () => {
    const today = new Date();
    const [current, setCurrent] = useState({ year: 2026, month: 2 });
    const [selected, setSelected] = useState<string | null>("2026-03-01");
    const [detailAppt, setDetailAppt] = useState<typeof appointments[0] | null>(null);
    const [showNewPlan, setShowNewPlan] = useState(false);
    const [newPlan, setNewPlan] = useState({ name: "", phone: "", date: "", time: "", note: "" });

    const { year, month } = current;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const pad = (n: number) => n.toString().padStart(2, "0");

    const prev = () => setCurrent(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
    const next = () => setCurrent(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });

    const apptsByDate = (date: string) => appointments.filter(a => a.date === date).sort((a, b) => a.time.localeCompare(b.time));
    const selectedAppts = selected ? apptsByDate(selected) : [];

    return (
        <div className="h-[calc(100vh-80px)] xl:h-screen flex flex-col p-4 md:p-6 lg:pb-6 pb-20 overflow-hidden">
            <div className="w-full max-w-[1400px] mx-auto flex flex-col h-full gap-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
                            <CalendarDays className="w-6 h-6 text-[#CCFF00]" />
                            Zamanlanmış Çağrılar
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Aramak için beklenen numaralar ve randevular</p>
                    </div>
                    <button onClick={() => setShowNewPlan(true)} className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 transition-all w-full sm:w-auto justify-center group">
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Yeni Plan Oluştur
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">

                    {/* Left Panel: Calendar Grid */}
                    <div className="lg:col-span-8 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative">
                        {/* Decorative glow */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#CCFF00]/5 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>

                        <div className="p-6 md:p-8 flex flex-col h-full relative z-10">
                            {/* Month Navigation */}
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black text-white px-2 tracking-wide">
                                    {MONTHS[month]} <span className="text-slate-500 font-medium">{year}</span>
                                </h2>
                                <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50">
                                    <button onClick={prev} className="p-2.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button onClick={next} className="p-2.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Days Header */}
                            <div className="grid grid-cols-7 mb-4 px-2">
                                {DAYS.map(d => (
                                    <div key={d} className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">{d}</div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-2 lg:gap-3 flex-1 px-2">
                                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="opacity-0" />)}

                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                                    const appts = apptsByDate(dateStr);
                                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                                    const isSelected = selected === dateStr;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => setSelected(dateStr)}
                                            className={cn(
                                                "relative flex flex-col items-center pt-3 pb-2 rounded-2xl transition-all duration-300 min-h-[80px] group border",
                                                isSelected
                                                    ? "bg-[#CCFF00] border-[#CCFF00] shadow-[0_0_20px_rgba(204,255,0,0.2)] scale-105 z-10"
                                                    : isToday
                                                        ? "bg-slate-800 border-slate-600 shadow-inner"
                                                        : "bg-slate-800/30 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-lg font-bold mb-1",
                                                isSelected ? "text-slate-900" : isToday ? "text-white" : "text-slate-300 group-hover:text-white"
                                            )}>
                                                {day}
                                            </span>

                                            {/* Indicators */}
                                            {appts.length > 0 && (
                                                <div className="flex flex-wrap justify-center gap-1 px-2 mt-auto">
                                                    {appts.slice(0, 3).map((a, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "w-1.5 h-1.5 rounded-full shadow-sm",
                                                                isSelected
                                                                    ? "bg-slate-900"
                                                                    : a.tag === "hot"
                                                                        ? "bg-red-500 shadow-red-500/50"
                                                                        : "bg-[#CCFF00] shadow-[#CCFF00]/50"
                                                            )}
                                                        />
                                                    ))}
                                                    {appts.length > 3 && (
                                                        <div className={cn("w-1.5 h-1.5 rounded-full opacity-50", isSelected ? "bg-slate-900" : "bg-slate-400")} />
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Daily Agenda */}
                    <div className="lg:col-span-4 flex flex-col gap-6 min-h-0">

                        {/* Selected Day Agenda */}
                        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-md p-6 flex flex-col flex-1 min-h-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-[60px] -mr-10 -mt-10 pointer-events-none"></div>

                            <div className="flex items-center justify-between mb-6 relative z-10">
                                <div>
                                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Seçili Gün</h3>
                                    <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
                                        {selected ? `${pad(parseInt(selected.split("-")[2]))} ${MONTHS[parseInt(selected.split("-")[1]) - 1]}` : "Gün Seçin"}
                                        {selected && <span className="text-sm font-bold text-slate-400">{year}</span>}
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
                                    <span className="text-[#CCFF00] font-bold text-sm">{selectedAppts.length}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10 space-y-3">
                                {selectedAppts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-60">
                                        <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                                            <CalendarDays className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-bold text-gray-400">Bu gün için planlanan arama yok.</p>
                                    </div>
                                ) : (
                                    selectedAppts.map(a => (
                                        <div
                                            key={a.id}
                                            onClick={() => setDetailAppt(a)}
                                            className="group flex gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-slate-900 hover:text-white border border-gray-100 hover:border-slate-800 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                                        >
                                            {/* Time block */}
                                            <div className="flex flex-col items-center justify-center flex-shrink-0 w-14">
                                                <p className="text-sm font-black text-slate-900 group-hover:text-[#CCFF00] transition-colors">{a.time}</p>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px bg-gray-200 group-hover:bg-slate-700 transition-colors my-1"></div>

                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-base font-bold text-slate-900 group-hover:text-white truncate transition-colors">{a.name}</p>
                                                    {a.tag === "hot" && <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />}
                                                </div>
                                                <p className="text-[11px] font-mono text-gray-500 group-hover:text-slate-400 transition-colors mb-1.5">{a.phone}</p>
                                                <p className="text-xs text-gray-600 group-hover:text-slate-300 font-medium line-clamp-1 italic transition-colors">"{a.note}"</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Upcoming Mini List */}
                        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl flex-shrink-0 border border-slate-800">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-[#CCFF00]" /> Yaklaşan Tüm Görevler
                            </h3>
                            <div className="space-y-4">
                                {appointments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(a => (
                                    <div key={a.id} className="flex items-center gap-3 group">
                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex flex-col items-center justify-center border border-slate-700/50 group-hover:border-[#CCFF00]/50 transition-colors">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-0.5">{MONTHS[parseInt(a.date.split("-")[1]) - 1].slice(0, 3)}</span>
                                            <span className="text-sm font-black text-white leading-none">{pad(parseInt(a.date.split("-")[2]))}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-200 truncate">{a.name}</p>
                                            <p className="text-xs font-medium text-slate-500">{a.time} - Bekliyor</p>
                                        </div>
                                        {a.tag === "hot" && <Flame className="w-4 h-4 text-red-500/80 mr-1" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Modal Detail Overlay */}
            {detailAppt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>

                        <div className="bg-slate-900 p-6 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-[#CCFF00]/10 to-transparent"></div>
                            <button onClick={() => setDetailAppt(null)} className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10">
                                <X className="w-5 h-5" />
                            </button>

                            <div className="w-20 h-20 rounded-[1.5rem] bg-slate-800 border-2 border-slate-700 shadow-xl flex items-center justify-center mb-4 relative z-10">
                                <span className="text-3xl font-black text-white">{detailAppt.name[0]}</span>
                            </div>
                            <h2 className="text-xl font-black text-white px-8 text-center relative z-10">{detailAppt.name}</h2>
                            <p className="text-sm font-mono text-[#CCFF00] mt-1 relative z-10">{detailAppt.phone}</p>
                        </div>

                        <div className="p-6 bg-gray-50/50 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                                    <CalendarDays className="w-5 h-5 text-gray-400 mb-2" />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Tarih</p>
                                    <p className="text-sm font-bold text-gray-900">{parseInt(detailAppt.date.split("-")[2])} {MONTHS[parseInt(detailAppt.date.split("-")[1]) - 1]} {detailAppt.date.split("-")[0]}</p>
                                </div>
                                <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
                                    <Clock className="w-5 h-5 text-gray-400 mb-2" />
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Saat</p>
                                    <p className="text-sm font-bold text-gray-900">{detailAppt.time}</p>
                                </div>
                            </div>

                            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Flame className="w-3 h-3" /> Görev Notu (Prompt)
                                </p>
                                <p className="text-sm font-medium text-amber-900">"{detailAppt.note}"</p>
                            </div>

                            <button onClick={() => setDetailAppt(null)} className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-900 text-[#CCFF00] py-3.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98] transition-all">
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Yeni Plan Modal */}
            {showNewPlan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNewPlan(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Yeni Plan Oluştur</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Yeni bir arama planı ekleyin</p>
                            </div>
                            <button onClick={() => setShowNewPlan(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">İsim</label>
                                    <input type="text" value={newPlan.name}
                                        onChange={(e) => setNewPlan(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Müşteri adı"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Telefon</label>
                                    <input type="tel" value={newPlan.phone}
                                        onChange={(e) => setNewPlan(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="+90 5XX XXX XX XX"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 transition-all" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Tarih</label>
                                    <input type="date" value={newPlan.date}
                                        onChange={(e) => setNewPlan(p => ({ ...p, date: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Saat</label>
                                    <input type="time" value={newPlan.time}
                                        onChange={(e) => setNewPlan(p => ({ ...p, time: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Not</label>
                                <textarea value={newPlan.note}
                                    onChange={(e) => setNewPlan(p => ({ ...p, note: e.target.value }))}
                                    placeholder="Görev notu veya açıklama..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 transition-all resize-none" />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                            <button onClick={() => setShowNewPlan(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                İptal
                            </button>
                            <button
                                onClick={() => {
                                    setShowNewPlan(false);
                                    setNewPlan({ name: "", phone: "", date: "", time: "", note: "" });
                                }}
                                disabled={!newPlan.name || !newPlan.phone || !newPlan.date || !newPlan.time}
                                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                                    newPlan.name && newPlan.phone && newPlan.date && newPlan.time
                                        ? "bg-slate-800 text-white hover:bg-slate-900 shadow-lg shadow-slate-900/10"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                                )}>
                                <Plus className="w-4 h-4" /> Plan Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
