import { useState, useEffect, useCallback } from "react";
import {
    ChevronLeft, ChevronRight, CalendarDays, Clock,
    Phone, MapPin, User, Plus, X, CheckCircle2,
    XCircle, Loader2, RefreshCw, Navigation, AlertTriangle
} from "lucide-react";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";

/* ── Types ─────────────────────────────────────────────────── */
interface Appointment {
    id: string;
    conversation_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    appointment_date: string | null;
    appointment_time: string | null;
    appointment_address: string | null;
    latitude: number | null;
    longitude: number | null;
    call_duration_secs: number | null;
    agent_id: string | null;
    status: "confirmed" | "completed" | "cancelled";
    notes: string | null;
    created_at: string;
}

/* ── Constants ──────────────────────────────────────────────── */
const DAYS   = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const STATUS_CFG = {
    confirmed: { label: "Onaylı",    cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
    completed: { label: "Tamamlandı",cls: "bg-slate-100 text-slate-600 border-slate-200",       dot: "bg-slate-400"  },
    cancelled: { label: "İptal",     cls: "bg-red-100 text-red-600 border-red-200",             dot: "bg-red-400"    },
};

const EMPTY_FORM = { customer_name: "", customer_phone: "", appointment_date: "", appointment_time: "", appointment_address: "", notes: "" };

/* ── Helpers ────────────────────────────────────────────────── */
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return (new Date(y, m, 1).getDay() + 6) % 7; }
function pad(n: number)                        { return n.toString().padStart(2, "0"); }
function fmtDuration(secs: number | null)      {
    if (!secs) return null;
    const m = Math.floor(secs / 60), s = secs % 60;
    return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
}
// Try to parse ISO date from appointment_date field (might be text like "Perşembe")
function tryParseDate(d: string | null): string | null {
    if (!d) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    return iso;
}

/* ══════════════════════════════════════════════════════════════ */
export const CalendarPage = () => {
    const today = new Date();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading]           = useState(true);
    const [saving, setSaving]             = useState(false);
    const [error, setError]               = useState<string | null>(null);

    const [current, setCurrent]     = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selected, setSelected]   = useState<string>(() => {
        return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    });
    const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
    const [showNew, setShowNew]       = useState(false);
    const [form, setForm]             = useState(EMPTY_FORM);

    /* ── Fetch ───────────────────────────────────────────────── */
    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) setError(error.message);
        else setAppointments((data || []) as Appointment[]);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

    /* ── Status update ──────────────────────────────────────── */
    const updateStatus = async (id: string, status: Appointment["status"]) => {
        await supabase.from("appointments").update({ status }).eq("id", id);
        setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
        if (detailAppt?.id === id) setDetailAppt(prev => prev ? { ...prev, status } : null);
    };

    /* ── Save new ───────────────────────────────────────────── */
    const handleSave = async () => {
        if (!form.customer_name.trim() || !form.appointment_date) return;
        setSaving(true);
        const { error } = await supabase.from("appointments").insert({
            ...form,
            status: "confirmed",
        });
        if (error) setError(error.message);
        else { setShowNew(false); setForm(EMPTY_FORM); fetchAppointments(); }
        setSaving(false);
    };

    /* ── Derived ─────────────────────────────────────────────── */
    const { year, month } = current;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay    = getFirstDay(year, month);

    // Map appointments to calendar dates (only those with ISO date in appointment_date)
    const calMap = new Map<string, Appointment[]>();
    appointments.forEach(a => {
        const d = tryParseDate(a.appointment_date);
        if (d) {
            if (!calMap.has(d)) calMap.set(d, []);
            calMap.get(d)!.push(a);
        }
    });

    const selectedCalAppts = calMap.get(selected) || [];

    // Stats
    const totalCount     = appointments.length;
    const confirmedCount = appointments.filter(a => a.status === "confirmed").length;
    const todayStr       = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    const todayCount     = (calMap.get(todayStr) || []).length;
    const completedCount = appointments.filter(a => a.status === "completed").length;

    /* ══════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen p-6 md:p-8 bg-[#FAFAFC]">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Takvim</h1>
                        <p className="text-sm text-slate-500 mt-1">AI aramalarından gelen randevular ve planlama</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={fetchAppointments} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-all">
                            <RefreshCw className="w-4 h-4" /> Yenile
                        </button>
                        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-900/10">
                            <Plus className="w-4 h-4" /> Yeni Randevu
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Toplam Randevu", value: totalCount,     color: "text-slate-800",   bg: "bg-slate-50",   icon: CalendarDays },
                        { label: "Onaylı",          value: confirmedCount, color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle2 },
                        { label: "Bugün",           value: todayCount,     color: "text-blue-700",    bg: "bg-blue-50",    icon: Clock },
                        { label: "Tamamlandı",      value: completedCount, color: "text-slate-500",   bg: "bg-slate-50",   icon: CheckCircle2 },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.bg)}>
                                <s.icon className={cn("w-5 h-5", s.color)} />
                            </div>
                            <div>
                                <p className={cn("text-2xl font-bold tracking-tight", s.color)}>{s.value}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ── Calendar Grid ── */}
                    <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6 md:p-8">
                        {/* Month nav */}
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-white">
                                {MONTHS[month]} <span className="text-slate-500 font-medium">{year}</span>
                            </h2>
                            <div className="flex gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                                <button onClick={() => setCurrent(c => c.month === 0 ? { year: c.year-1, month: 11 } : { ...c, month: c.month-1 })}
                                    className="p-2.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setCurrent({ year: today.getFullYear(), month: today.getMonth() })}
                                    className="px-3 text-xs font-bold text-slate-400 hover:text-white transition-all">
                                    Bugün
                                </button>
                                <button onClick={() => setCurrent(c => c.month === 11 ? { year: c.year+1, month: 0 } : { ...c, month: c.month+1 })}
                                    className="p-2.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Day headers */}
                        <div className="grid grid-cols-7 mb-3">
                            {DAYS.map(d => (
                                <div key={d} className="text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">{d}</div>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-7 gap-1.5">
                            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day     = i + 1;
                                const dateStr = `${year}-${pad(month+1)}-${pad(day)}`;
                                const appts   = calMap.get(dateStr) || [];
                                const isToday = dateStr === todayStr;
                                const isSel   = selected === dateStr;

                                return (
                                    <button key={day} onClick={() => setSelected(dateStr)}
                                        className={cn(
                                            "relative flex flex-col items-center py-3 rounded-xl transition-all duration-200 min-h-[64px] border",
                                            isSel   ? "bg-[#CCFF00] border-[#CCFF00] scale-105 shadow-[0_0_16px_rgba(204,255,0,0.25)] z-10"
                                            : isToday ? "bg-slate-800 border-slate-600"
                                            : "bg-slate-800/30 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                                        )}>
                                        <span className={cn("text-sm font-bold",
                                            isSel ? "text-slate-900" : isToday ? "text-white" : "text-slate-300")}>
                                            {day}
                                        </span>
                                        {appts.length > 0 && (
                                            <div className="flex gap-1 mt-auto pt-1 flex-wrap justify-center px-1">
                                                {appts.slice(0, 3).map((a, idx) => (
                                                    <div key={idx} className={cn("w-1.5 h-1.5 rounded-full",
                                                        isSel ? "bg-slate-900"
                                                        : a.status === "confirmed" ? "bg-emerald-400"
                                                        : a.status === "completed" ? "bg-slate-400"
                                                        : "bg-red-400")} />
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Selected day appointments */}
                        {selectedCalAppts.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-800">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                    {pad(parseInt(selected.split("-")[2]))} {MONTHS[parseInt(selected.split("-")[1])-1]} — {selectedCalAppts.length} randevu
                                </p>
                                <div className="space-y-2">
                                    {selectedCalAppts.map(a => (
                                        <button key={a.id} onClick={() => setDetailAppt(a)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 transition-all text-left">
                                            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_CFG[a.status].dot)} />
                                            <span className="text-sm font-bold text-white flex-1 truncate">{a.customer_name || "—"}</span>
                                            {a.appointment_time && (
                                                <span className="text-xs font-mono text-[#CCFF00]">{a.appointment_time}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Appointment List ── */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tüm Randevular</h3>
                                <span className="text-xs font-bold text-slate-400">{totalCount} kayıt</span>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-sm">Yükleniyor...</span>
                                </div>
                            ) : appointments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                    <CalendarDays className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-medium">Henüz randevu yok</p>
                                    <p className="text-xs text-slate-300">AI aramaları tamamlandıkça buraya düşecek</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                                    {appointments.map(a => {
                                        const sc = STATUS_CFG[a.status];
                                        return (
                                            <button key={a.id} onClick={() => setDetailAppt(a)}
                                                className="w-full flex items-start gap-4 px-6 py-4 hover:bg-slate-50/80 transition-all text-left group">
                                                {/* Avatar */}
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                                                    <User className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="text-sm font-bold text-slate-800 truncate">
                                                            {a.customer_name || "İsimsiz"}
                                                        </p>
                                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0", sc.cls)}>
                                                            {sc.label}
                                                        </span>
                                                    </div>
                                                    {a.customer_phone && (
                                                        <p className="text-xs font-mono text-slate-400 mb-1">📞 {a.customer_phone}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        {a.appointment_date && (
                                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                                <CalendarDays className="w-3 h-3" /> {a.appointment_date}
                                                                {a.appointment_time && ` · ${a.appointment_time}`}
                                                            </span>
                                                        )}
                                                        {(a.latitude && a.longitude) && (
                                                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" /> Konum var
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[11px] text-slate-300 flex-shrink-0 mt-0.5">
                                                    {new Date(a.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detail Modal ── */}
            {detailAppt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailAppt(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden">

                        {/* Header */}
                        <div className="bg-slate-900 p-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#CCFF00]/10 to-transparent pointer-events-none" />
                            <button onClick={() => setDetailAppt(null)} className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                                <X className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                                    <span className="text-2xl font-black text-white">
                                        {(detailAppt.customer_name || "?")[0].toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">{detailAppt.customer_name || "İsimsiz"}</h2>
                                    {detailAppt.customer_phone && (
                                        <p className="text-sm font-mono text-[#CCFF00] mt-0.5">{detailAppt.customer_phone}</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 relative z-10">
                                <span className={cn("text-[11px] font-bold px-3 py-1.5 rounded-lg border", STATUS_CFG[detailAppt.status].cls)}>
                                    {STATUS_CFG[detailAppt.status].label}
                                </span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" /> Randevu Tarihi
                                    </p>
                                    <p className="text-sm font-bold text-slate-800">{detailAppt.appointment_date || "—"}</p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Saat
                                    </p>
                                    <p className="text-sm font-bold text-slate-800">{detailAppt.appointment_time || "—"}</p>
                                </div>
                            </div>

                            {detailAppt.appointment_address && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Adres
                                    </p>
                                    <p className="text-sm font-bold text-slate-800">{detailAppt.appointment_address}</p>
                                </div>
                            )}

                            {detailAppt.latitude && detailAppt.longitude && (
                                <a href={`https://maps.google.com/?q=${detailAppt.latitude},${detailAppt.longitude}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-700 hover:bg-emerald-100 transition-all">
                                    <Navigation className="w-4 h-4" />
                                    Google Maps'te Aç
                                    <span className="text-xs font-mono text-emerald-500 ml-auto">
                                        {detailAppt.latitude.toFixed(4)}, {detailAppt.longitude.toFixed(4)}
                                    </span>
                                </a>
                            )}

                            {detailAppt.call_duration_secs != null && detailAppt.call_duration_secs > 0 && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Phone className="w-3.5 h-3.5" />
                                    Görüşme süresi: <span className="font-bold text-slate-600">{fmtDuration(detailAppt.call_duration_secs)}</span>
                                </div>
                            )}

                            {detailAppt.notes && (
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Not</p>
                                    <p className="text-sm text-amber-900">{detailAppt.notes}</p>
                                </div>
                            )}

                            {/* Status actions */}
                            {detailAppt.status !== "completed" && detailAppt.status !== "cancelled" && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => updateStatus(detailAppt.id, "completed")}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-all">
                                        <CheckCircle2 className="w-4 h-4" /> Tamamlandı
                                    </button>
                                    <button onClick={() => updateStatus(detailAppt.id, "cancelled")}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-100 text-red-500 text-sm font-bold hover:bg-red-50 transition-all">
                                        <XCircle className="w-4 h-4" /> İptal Et
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── New Appointment Modal ── */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800">Yeni Randevu</h2>
                            <button onClick={() => setShowNew(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">İsim *</label>
                                    <input type="text" value={form.customer_name}
                                        onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                                        placeholder="Müşteri adı"
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Telefon</label>
                                    <input type="tel" value={form.customer_phone}
                                        onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                                        placeholder="+90 5XX XXX XX XX"
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Tarih *</label>
                                    <input type="date" value={form.appointment_date}
                                        onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Saat</label>
                                    <input type="time" value={form.appointment_time}
                                        onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Adres</label>
                                <input type="text" value={form.appointment_address}
                                    onChange={e => setForm(p => ({ ...p, appointment_address: e.target.value }))}
                                    placeholder="Randevu adresi"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Not</label>
                                <textarea value={form.notes}
                                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Ek bilgi..."
                                    rows={2}
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:border-slate-400 transition-all resize-none" />
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                            <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                İptal
                            </button>
                            <button onClick={handleSave}
                                disabled={!form.customer_name.trim() || !form.appointment_date || saving}
                                className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                                    form.customer_name.trim() && form.appointment_date && !saving
                                        ? "bg-slate-800 text-white hover:bg-slate-900"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed")}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
