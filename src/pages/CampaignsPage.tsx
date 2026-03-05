import { useState } from "react";
import {
    Radio, Play, Pause, Trash2, Plus, Upload,
    Phone, CheckCircle2, XCircle, ChevronRight,
    Users, Zap, Clock, MoreVertical, TrendingUp
} from "lucide-react";
import { cn } from "@/utils/cn";

type CampaignStatus = "active" | "paused" | "completed" | "draft";

const campaigns = [
    {
        id: 1, name: "Mart Kampanyası — Klinikler", status: "active" as CampaignStatus,
        total: 250, called: 147, answered: 112, hot: 38, cold: 74, appointments: 12,
        createdAt: "28 Şubat 2026", progress: 59
    },
    {
        id: 2, name: "Vip Müşteri Takip", status: "paused" as CampaignStatus,
        total: 80, called: 45, answered: 40, hot: 18, cold: 22, appointments: 5,
        createdAt: "25 Şubat 2026", progress: 56
    },
    {
        id: 3, name: "Yeni Ürün Duyurusu", status: "completed" as CampaignStatus,
        total: 120, called: 120, answered: 98, hot: 42, cold: 56, appointments: 19,
        createdAt: "20 Şubat 2026", progress: 100
    },
    {
        id: 4, name: "B2B Segment — İnşaat", status: "draft" as CampaignStatus,
        total: 300, called: 0, answered: 0, hot: 0, cold: 0, appointments: 0,
        createdAt: "1 Mart 2026", progress: 0
    },
];

const statusConfig: Record<CampaignStatus, { label: string; cls: string; dot: string }> = {
    active: { label: "Aktif", cls: "badge-appointment", dot: "bg-emerald-500" },
    paused: { label: "Durduruldu", cls: "badge-cold", dot: "bg-amber-400" },
    completed: { label: "Tamamlandı", cls: "badge-purple", dot: "bg-gray-900" },
    draft: { label: "Taslak", cls: "badge-missed", dot: "bg-gray-400" },
};

export const CampaignsPage = () => {
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState("");
    const [campaignList, setCampaignList] = useState(campaigns);

    const totalStats = {
        active: campaignList.filter(c => c.status === "active").length,
        called: campaignList.reduce((a, c) => a + c.called, 0),
        hot: campaignList.reduce((a, c) => a + c.hot, 0),
        appt: campaignList.reduce((a, c) => a + c.appointments, 0),
    };

    return (
        <div className="min-h-screen p-6 md:p-8" style={{ background: "linear-gradient(160deg,#f5f3ff 0%,#faf9ff 40%,#f0fdf4 100%)" }}>
            <div className="max-w-[1200px] mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                            Kampanyalar
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Toplu arama kampanyalarınızı yönetin</p>
                    </div>
                    <button onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm btn-primary">
                        <Plus className="w-4 h-4" />
                        Yeni Kampanya
                    </button>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: "Aktif Kampanya", value: totalStats.active, Icon: Radio, color: "text-gray-900", bg: "bg-gray-900" },
                        { label: "Toplam Aranan", value: totalStats.called, Icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
                        { label: "Sıcak Lead", value: totalStats.hot, Icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
                        { label: "Randevu Alındı", value: totalStats.appt, Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-5 card flex items-center gap-4">
                            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", s.bg)}>
                                <s.Icon className={cn("w-5 h-5", s.color)} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Campaign List */}
                <div className="space-y-4">
                    {campaignList.map((c) => {
                        const sc = statusConfig[c.status];
                        return (
                            <div key={c.id} className="bg-white rounded-3xl p-6 card">
                                <div className="flex flex-col md:flex-row md:items-start gap-4">

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={cn("w-2 h-2 rounded-full", sc.dot)} />
                                            <h3 className="text-base font-bold text-gray-900 truncate">{c.name}</h3>
                                            <span className={sc.cls}>{sc.label}</span>
                                        </div>

                                        {/* Stats row */}
                                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                                            {[
                                                { label: "Toplam", value: c.total },
                                                { label: "Aranan", value: c.called },
                                                { label: "Yanıtlayan", value: c.answered },
                                                { label: "🔥 Sıcak", value: c.hot },
                                                { label: "❄ Soğuk", value: c.cold },
                                                { label: "📅 Randevu", value: c.appointments },
                                            ].map(s => (
                                                <div key={s.label} className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                                    <p className="text-lg font-bold text-gray-900">{s.value}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Progress bar */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs text-gray-500">İlerleme</span>
                                                <span className="text-xs font-bold text-gray-900">%{c.progress}</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${c.progress}%`, background: "#CCFF00" }} />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">{c.createdAt} tarihinde oluşturuldu</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex md:flex-col gap-2 flex-shrink-0">
                                        {c.status === "active" && (
                                            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100 hover:bg-amber-100 transition-colors">
                                                <Pause className="w-4 h-4" /> Durdur
                                            </button>
                                        )}
                                        {c.status === "paused" && (
                                            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100 hover:bg-emerald-100 transition-colors">
                                                <Play className="w-4 h-4" /> Devam
                                            </button>
                                        )}
                                        {c.status === "draft" && (
                                            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl btn-primary text-xs">
                                                <Play className="w-4 h-4" /> Başlat
                                            </button>
                                        )}
                                        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                                            <ChevronRight className="w-4 h-4" /> Detay
                                        </button>
                                        {c.status !== "active" && (
                                            <button className="p-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* New Campaign Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 animate-fadeInUp">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Yeni Kampanya Oluştur</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Kampanya Adı</label>
                                <input
                                    className="input-base"
                                    placeholder="Örn: Mart Kliniği Aramaları"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Numara Listesi</label>
                                <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-200 hover:bg-gray-900/30 transition-all">
                                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600 font-medium">CSV veya TXT dosyası yükleyin</p>
                                    <p className="text-xs text-gray-400 mt-1">Her satırda bir telefon numarası</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Günlük Maksimum Arama</label>
                                <input className="input-base" type="number" placeholder="100" defaultValue={50} />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                                İptal
                            </button>
                            <button onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-2xl btn-primary text-sm">
                                Kampanyayı Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
