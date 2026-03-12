import { useState } from "react";
import {
    MessageSquare, CheckCircle2, Clock, XCircle, QrCode,
    RefreshCw, Send, Flame, Snowflake, CalendarCheck,
    Plus, Trash2, Edit2, Zap, X
} from "lucide-react";
import { cn } from "@/utils/cn";

const templates = [
    {
        id: 1, name: "Sıcak Lead — Demo Daveti", trigger: "hot",
        message: "Merhaba {isim}! 👋 LUNA asistanınız üzerinden iletişime geçiyoruz. Görüşmemiz için teşekkürler. Size özel ürün demomuzu göstermek isteriz. 📅 Uygun gün ve saatiniz nedir?",
        sent: 38, pending: 5
    },
    {
        id: 2, name: "Randevu Hatırlatıcısı", trigger: "appointment",
        message: "Merhaba {isim}! LUNA üzerinden yarınki {saat} randevunuzu hatırlatmak istedik. Görüşmeyi sabırsızlıkla bekliyoruz. ✅ Değişiklik için lütfen bizi arayın.",
        sent: 12, pending: 2
    },
    {
        id: 3, name: "Soğuk Lead — 3 Ay Sonra", trigger: "cold",
        message: "Merhaba {isim}! Sizi bir süre önce LUNA ile aramıştık. Yeni çözümlerimizle ilgili harika haberlerimiz var. 📞 Müsait olduğunuzda tekrar görüşebilir miyiz?",
        sent: 24, pending: 8
    },
];

const queueItems = [
    { id: 1, name: "Ahmet Yılmaz", phone: "+90 532 111 22 33", template: "Sıcak Lead — Demo Daveti", status: "sent" as const, time: "5 dk önce" },
    { id: 2, name: "Fatma Öztürk", phone: "+90 537 666 77 88", template: "Randevu Hatırlatıcısı", status: "sent" as const, time: "12 dk önce" },
    { id: 3, name: "Hakan Eren", phone: "+90 531 999 00 11", template: "Soğuk Lead — 3 Ay Sonra", status: "pending" as const, time: "Bekliyor" },
    { id: 4, name: "Selin Aksoy", phone: "+90 532 000 11 22", template: "Randevu Hatırlatıcısı", status: "pending" as const, time: "Bekliyor" },
    { id: 5, name: "Bilinmeyen", phone: "+90 534 333 44 55", template: "Sıcak Lead — Demo Daveti", status: "failed" as const, time: "1 sa önce" },
];

const triggerConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
    hot: { cls: "bg-orange-100/80 text-orange-700 border-orange-200", icon: <Flame className="w-3 h-3 fill-orange-500 text-orange-600" /> },
    cold: { cls: "bg-blue-100/80 text-blue-700 border-blue-200", icon: <Snowflake className="w-3 h-3 text-blue-600" /> },
    appointment: { cls: "bg-emerald-100/80 text-emerald-700 border-emerald-200", icon: <CalendarCheck className="w-3 h-3 text-emerald-600" /> },
};

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    sent: { label: "Gönderildi", cls: "bg-emerald-100/80 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    pending: { label: "Bekliyor", cls: "bg-amber-100/80 text-amber-800 border-amber-200", icon: <Clock className="w-3 h-3" /> },
    failed: { label: "Başarısız", cls: "bg-red-100/80 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> },
};

export const WhatsAppPage = () => {
    const [waConnected] = useState(true);
    const [activeTab, setActiveTab] = useState<"templates" | "queue">("templates");
    const [showNewTemplate, setShowNewTemplate] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: "", trigger: "hot", message: "" });

    return (
        <div className="min-h-screen p-6 md:p-8 bg-[#FAFAFC] font-sans">
            <div className="max-w-[1200px] mx-auto space-y-7">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">WhatsApp</h1>
                        <p className="text-sm text-slate-500 mt-1">Otomatik mesaj şablonları ve gönderim yönetimi</p>
                    </div>

                    {/* WA Connection status */}
                    <div className={cn("flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all",
                        waConnected ? "bg-emerald-50 border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.05)]" : "bg-red-50 border-red-100")}>
                        <div className={cn("w-2 h-2 rounded-full", waConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                        <span className={cn("text-[13px] font-bold", waConnected ? "text-emerald-700" : "text-red-700")}>
                            {waConnected ? "WhatsApp Bağlı" : "Bağlantı Yok"}
                        </span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: "Toplam Gönderilen", value: 74, icon: Send, color: "text-slate-600", bg: "bg-slate-50", accent: "text-slate-800" },
                        { label: "Bekleyen Mesaj", value: 15, icon: Clock, color: "text-amber-500", bg: "bg-amber-50", accent: "text-amber-700" },
                        { label: "Otomasyon Aktif", value: 3, icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50", accent: "text-emerald-700" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", s.bg)}>
                                <s.icon className={cn("w-5 h-5", s.color)} />
                            </div>
                            <div className="flex flex-col">
                                <h3 className={cn("text-2xl font-bold tracking-tight leading-none", s.accent)}>{s.value}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tabs + Action Button */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-100 w-fit shadow-sm">
                        {(["templates", "queue"] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={cn("px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                                    activeTab === tab
                                        ? "bg-slate-800 text-white shadow-lg shadow-slate-900/10"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}>
                                {tab === "templates" ? "Mesaj Şablonları" : "Gönderim Kuyruğu"}
                            </button>
                        ))}
                    </div>
                    {activeTab === "templates" && (
                        <button onClick={() => setShowNewTemplate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                            <Plus className="w-4 h-4" /> Yeni Şablon
                        </button>
                    )}
                </div>

                {/* Templates Tab */}
                {activeTab === "templates" && (
                    <div className="space-y-4">
                        {templates.map(t => {
                            const trig = triggerConfig[t.trigger];
                            return (
                                <div key={t.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_5px_20px_rgba(0,0,0,0.02)] group hover:shadow-md transition-all">
                                    <div className="flex items-start justify-between gap-4 mb-5">
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-lg text-slate-800 tracking-tight">{t.name}</h3>
                                            <div className="flex items-center gap-3">
                                                <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm", trig.cls)}>
                                                    {trig.icon} {t.trigger === "hot" ? "Sıcak Lead" : t.trigger === "cold" ? "Soğuk Lead" : "Randevu"}
                                                </span>
                                                <div className="h-4 w-px bg-slate-100" />
                                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.sent} gönderildi · {t.pending} bekliyor</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button className="p-2.5 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all shadow-sm">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-2.5 rounded-xl border border-red-50 text-red-300 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-5 group-hover:bg-white group-hover:border-emerald-100 transition-all shadow-sm">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100">
                                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Önizleme</span>
                                        </div>
                                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{t.message}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Queue Tab */}
                {activeTab === "queue" && (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_5px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Gönderim Kuyruğu</h3>
                            <button className="flex items-center gap-2 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg transition-all shadow-sm">
                                <RefreshCw className="w-3.5 h-3.5" /> Yenile
                            </button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {queueItems.map(item => {
                                const sc = statusConfig[item.status];
                                return (
                                    <div key={item.id} className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50/80 transition-all group">
                                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] font-extrabold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{item.name}</p>
                                            <p className="text-[11px] text-slate-400 font-mono tracking-widest mt-0.5 font-semibold">{item.phone}</p>
                                        </div>
                                        <div className="hidden lg:block flex-[1.5] min-w-0">
                                            <p className="text-xs font-semibold text-slate-500 truncate bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{item.template}</p>
                                        </div>
                                        <div className="flex items-center gap-5 flex-shrink-0">
                                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-sm", sc.cls)}>
                                                {sc.icon} {sc.label}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums w-20 text-right">{item.time}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Yeni Şablon Modal */}
            {showNewTemplate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowNewTemplate(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Yeni Şablon Oluştur</h2>
                                <p className="text-xs text-slate-400 mt-0.5">WhatsApp mesaj şablonu ekleyin</p>
                            </div>
                            <button onClick={() => setShowNewTemplate(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-5">
                            {/* Şablon Adı */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Şablon Adı</label>
                                <input
                                    type="text"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Ör: Sıcak Lead — Demo Daveti"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                                />
                            </div>

                            {/* Tetikleyici */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Tetikleyici</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: "hot", label: "Sıcak Lead", icon: <Flame className="w-3.5 h-3.5" />, activeClass: "bg-orange-50 border-orange-200 text-orange-700" },
                                        { value: "cold", label: "Soğuk Lead", icon: <Snowflake className="w-3.5 h-3.5" />, activeClass: "bg-blue-50 border-blue-200 text-blue-700" },
                                        { value: "appointment", label: "Randevu", icon: <CalendarCheck className="w-3.5 h-3.5" />, activeClass: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setNewTemplate(prev => ({ ...prev, trigger: opt.value }))}
                                            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
                                                newTemplate.trigger === opt.value
                                                    ? opt.activeClass + " shadow-sm"
                                                    : "border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                                            )}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mesaj */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Mesaj İçeriği</label>
                                <textarea
                                    value={newTemplate.message}
                                    onChange={(e) => setNewTemplate(prev => ({ ...prev, message: e.target.value }))}
                                    placeholder="Merhaba {isim}! Mesajınızı buraya yazın..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all resize-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1.5">Kullanılabilir değişkenler: <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">{'{isim}'}</span> <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">{'{saat}'}</span> <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded">{'{tarih}'}</span></p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                            <button onClick={() => setShowNewTemplate(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                İptal
                            </button>
                            <button
                                onClick={() => {
                                    // TODO: Save template logic
                                    setShowNewTemplate(false);
                                    setNewTemplate({ name: "", trigger: "hot", message: "" });
                                }}
                                disabled={!newTemplate.name || !newTemplate.message}
                                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                                    newTemplate.name && newTemplate.message
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                                )}
                            >
                                <Plus className="w-4 h-4" /> Şablon Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
