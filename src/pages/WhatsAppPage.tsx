import { useState } from "react";
import {
    MessageSquare, CheckCircle2, Clock, XCircle, QrCode,
    RefreshCw, Send, Flame, Snowflake, CalendarCheck,
    Plus, Trash2, Edit2, Zap
} from "lucide-react";
import { cn } from "@/utils/cn";

const templates = [
    {
        id: 1, name: "Sıcak Lead — Demo Daveti", trigger: "hot",
        message: "Merhaba {isim}! 👋 LUERA ekibinden arıyoruz. Az önce yaptığımız görüşmemiz için teşekkürler. Size özel ürün demomuzu göstermek isteriz. 📅 Uygun gün ve saattiniz nedir?",
        sent: 38, pending: 5
    },
    {
        id: 2, name: "Randevu Hatırlatıcısı", trigger: "appointment",
        message: "Merhaba {isim}! Yarın {saat} için randevunuz bulunmaktadır. Görüşmeyi sabırsızlıkla bekliyoruz. ✅ Değişiklik için lütfen bizi arayın.",
        sent: 12, pending: 2
    },
    {
        id: 3, name: "Soğuk Lead — 3 Ay Sonra", trigger: "cold",
        message: "Merhaba {isim}! Sizi bir süre önce aramıştık. Yeni çözümlerimizle ilgili paylaşacak güzel haberlerimiz var. 📞 Uygun bir zaman diliminde sizi tekrar arayabilir miyiz?",
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
    hot: { cls: "badge-hot", icon: <Flame className="w-3 h-3" /> },
    cold: { cls: "badge-cold", icon: <Snowflake className="w-3 h-3" /> },
    appointment: { cls: "badge-appointment", icon: <CalendarCheck className="w-3 h-3" /> },
};

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    sent: { label: "Gönderildi", cls: "badge-appointment", icon: <CheckCircle2 className="w-3 h-3" /> },
    pending: { label: "Bekliyor", cls: "badge-missed", icon: <Clock className="w-3 h-3" /> },
    failed: { label: "Başarısız", cls: "badge-hot", icon: <XCircle className="w-3 h-3" /> },
};

export const WhatsAppPage = () => {
    const [waConnected] = useState(true);
    const [activeTab, setActiveTab] = useState<"templates" | "queue">("templates");

    return (
        <div className="min-h-screen p-6 md:p-8" style={{ background: "linear-gradient(160deg,#f5f3ff 0%,#faf9ff 40%,#f0fdf4 100%)" }}>
            <div className="max-w-[1200px] mx-auto space-y-7">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>WhatsApp</h1>
                        <p className="text-sm text-gray-500 mt-1">Otomatik mesaj şablonları ve gönderim yönetimi</p>
                    </div>

                    {/* WA Connection status */}
                    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-2xl border",
                        waConnected ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
                        <div className={cn("w-2.5 h-2.5 rounded-full", waConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                        <span className={cn("text-sm font-bold", waConnected ? "text-emerald-700" : "text-red-700")}>
                            {waConnected ? "WhatsApp Bağlı" : "Bağlantı Yok"}
                        </span>
                        {!waConnected && (
                            <div className="ml-2 flex items-center gap-1.5 text-xs text-red-600 font-medium">
                                <QrCode className="w-4 h-4" /> QR Tara
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: "Toplam Gönderilen", value: 74, icon: Send, color: "text-gray-900", bg: "bg-gray-900" },
                        { label: "Bekleyen Mesaj", value: 15, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                        { label: "Otomasyon Aktif", value: 3, icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-5 card flex items-center gap-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                                <s.icon className={cn("w-5 h-5", s.color)} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                                <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white p-1 rounded-2xl border border-gray-100 w-fit">
                    {(["templates", "queue"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={cn("px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                                activeTab === tab ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                            {tab === "templates" ? "Mesaj Şablonları" : "Gönderim Kuyruğu"}
                        </button>
                    ))}
                </div>

                {/* Templates Tab */}
                {activeTab === "templates" && (
                    <div className="space-y-4">
                        <div className="flex justify-end">
                            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-sm">
                                <Plus className="w-4 h-4" /> Şablon Ekle
                            </button>
                        </div>
                        {templates.map(t => {
                            const trig = triggerConfig[t.trigger];
                            return (
                                <div key={t.id} className="bg-white rounded-3xl p-6 card">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 mb-1.5">{t.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border", trig.cls)}>
                                                    {trig.icon} Tetikleyici: {t.trigger === "hot" ? "Sıcak Lead" : t.trigger === "cold" ? "Soğuk Lead" : "Randevu"}
                                                </span>
                                                <span className="text-xs text-gray-400">{t.sent} gönderildi · {t.pending} bekliyor</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Mesaj Önizleme</span>
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">{t.message}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Queue Tab */}
                {activeTab === "queue" && (
                    <div className="bg-white rounded-3xl overflow-hidden card">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-sm">Gönderim Kuyruğu</h3>
                            <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 hover:text-gray-900 bg-gray-900 px-3 py-1.5 rounded-lg transition-colors">
                                <RefreshCw className="w-3 h-3" /> Yenile
                            </button>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {queueItems.map(item => {
                                const sc = statusConfig[item.status];
                                return (
                                    <div key={item.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors">
                                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                            <MessageSquare className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                            <p className="text-[11px] text-gray-400 font-mono">{item.phone}</p>
                                        </div>
                                        <div className="hidden md:block flex-1 min-w-0">
                                            <p className="text-xs text-gray-500 truncate">{item.template}</p>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className={cn("inline-flex items-center gap-1", sc.cls)}>{sc.icon}{sc.label}</span>
                                            <span className="text-[10px] text-gray-400">{item.time}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
