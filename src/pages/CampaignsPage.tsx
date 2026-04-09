import { useState, useRef } from "react";
import {
    Radio, Play, Pause, Trash2, Plus, Upload,
    Phone, CheckCircle2, ChevronRight,
    TrendingUp, FileText, Check, FileSpreadsheet,
    XCircle, Flame, CalendarCheck, Zap, Snowflake, Headphones
} from "lucide-react";
import { cn } from "@/utils/cn";
import { VoiceAgentDemoModal } from "@/components/VoiceAgentDemoModal";
import { AgentPromptEditor } from "@/components/AgentPromptEditor";
import { getPhoneNumbers, PhoneNumberItem } from "@/services/elevenlabsApi";

type CampaignStatus = "active" | "paused" | "completed" | "draft";

const campaigns = [
    {
        id: 1, name: "Mart Kampanyası — Klinikler", status: "active" as CampaignStatus,
        total: 250, called: 147, answered: 112, hot: 38, cold: 74, appointments: 12,
        createdAt: "28 Şubat 2026", progress: 59,
        agentId: "agent_6301knq9gn2nf3jryph25j66510p", // Gerçek LUNA/Klinik Ajanı
        agentRole: "Klinik Randevu Asistanı"
    },
    {
        id: 2, name: "Vip Müşteri Takip", status: "paused" as CampaignStatus,
        total: 80, called: 45, answered: 40, hot: 18, cold: 22, appointments: 5,
        createdAt: "25 Şubat 2026", progress: 56,
        agentId: "pqHfZKP75CvOlQylNhV4", // Bill (Örnek)
        agentRole: "VIP Müşteri Temsilcisi"
    },
    {
        id: 3, name: "Yeni Ürün Duyurusu", status: "completed" as CampaignStatus,
        total: 120, called: 120, answered: 98, hot: 42, cold: 56, appointments: 19,
        createdAt: "20 Şubat 2026", progress: 100,
        agentId: "cgSgspJ2msm6clMC8zVf", // Brian (Örnek)
        agentRole: "Satış & Tanıtım Uzmanı"
    },
    {
        id: 4, name: "B2B Segment — İnşaat", status: "draft" as CampaignStatus,
        total: 300, called: 0, answered: 0, hot: 0, cold: 0, appointments: 0,
        createdAt: "1 Mart 2026", progress: 0,
        agentId: "cjVigY5qzO86HvrZZtP0", // Callum (Örnek)
        agentRole: "B2B Ağ Geliştirme Asistanı"
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
    const [selectedCampaign, setSelectedCampaign] = useState<(typeof campaigns)[0] | null>(null);
    const [voiceDemoCampaign, setVoiceDemoCampaign] = useState<(typeof campaigns)[0] | null>(null);

    // File Upload & Config States
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [numberCount, setNumberCount] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberItem[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string>("");
    const [dailyLimit, setDailyLimit] = useState<number>(50);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Phone numbers on modal open
    useEffect(() => {
        if (showModal && phoneNumbers.length === 0) {
            getPhoneNumbers().then(nums => {
                setPhoneNumbers(nums);
                if (nums.length > 0) setSelectedPhone(nums[0].phone_number_id);
            }).catch(console.error);
        }
    }, [showModal]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploadedFile(file);
            setIsUploading(true);

            // Simülasyon: Dosya okuma efekti (gerçekte PapaParse vb ile okunmalı)
            setTimeout(() => {
                setIsUploading(false);
                setNumberCount(Math.floor(Math.random() * 200) + 20); // Örnek olarak 20-220 arası numara bulundu diyelim
            }, 1200);
        }
    };

    const removeFile = () => {
        setUploadedFile(null);
        setNumberCount(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setNewName("");
        removeFile();
    };

    const handleSaveCampaign = () => {
        if (!newName.trim()) return;

        const newCampaign = {
            id: Date.now(),
            name: newName,
            status: "draft" as CampaignStatus,
            total: numberCount || 0,
            called: 0,
            answered: 0,
            hot: 0,
            cold: 0,
            appointments: 0,
            createdAt: new Date().toLocaleDateString("tr-TR", { day: 'numeric', month: 'long', year: 'numeric' }),
            progress: 0,
            agentId: "agent_6701knh148pgfyvvsbfjeg27ps3n", // Default
            agentRole: "Genel Asistan"
        };

        setCampaignList(prev => [newCampaign, ...prev]);
        handleCloseModal();
    };

    const totalStats = {
        active: campaignList.filter(c => c.status === "active").length,
        called: campaignList.reduce((a, c) => a + c.called, 0),
        hot: campaignList.reduce((a, c) => a + c.hot, 0),
        appt: campaignList.reduce((a, c) => a + c.appointments, 0),
    };

    return (
        <div className="min-h-screen p-6 md:p-8 bg-slate-50/50">
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
                        { label: "Aktif Kampanya", value: totalStats.active, Icon: Radio, color: "text-[#CCFF00]", bg: "bg-gray-900", isAlive: true },
                        { label: "Toplam Aranan", value: totalStats.called, Icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
                        { label: "Sıcak Lead", value: totalStats.hot, Icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
                        { label: "Randevu Alındı", value: totalStats.appt, Icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden group hover:scale-[1.02] hover:shadow-md transition-all duration-300">

                            {/* Dashboard style alive dots on top right */}
                            <div className="absolute top-3 right-3 flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                                <div className={cn("w-1 h-1 rounded-full", s.isAlive ? "bg-[#CCFF00] shadow-[0_0_4px_#CCFF00] animate-pulse" : "bg-gray-300")}></div>
                                <div className={cn("w-1 h-1 rounded-full", s.isAlive ? "bg-slate-700" : "bg-gray-200")}></div>
                            </div>

                            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center relative flex-shrink-0", s.bg)}>
                                {/* Glow behind active icon */}
                                {s.isAlive && (
                                    <div className="absolute inset-0 rounded-xl bg-[#CCFF00] animate-ping opacity-20"></div>
                                )}
                                <s.Icon className={cn("w-5 h-5 relative z-10", s.color)} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-2xl font-bold text-gray-900 transition-all">{s.value}</p>
                                <p className="text-xs text-gray-500 font-medium truncate">{s.label}</p>
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
                                                { id: "total", label: "Toplam", value: c.total },
                                                { id: "called", label: "Aranan", value: c.called },
                                                { id: "answered", label: "Yanıtlayan", value: c.answered },
                                                { id: "hot", label: <span className="flex items-center gap-1 justify-center"><Flame className="w-3 h-3 text-orange-500" /> Sıcak</span>, value: c.hot },
                                                { id: "cold", label: <span className="flex items-center gap-1 justify-center"><Snowflake className="w-3 h-3 text-blue-500" /> Soğuk</span>, value: c.cold },
                                                { id: "appt", label: <span className="flex items-center gap-1 justify-center"><CalendarCheck className="w-3 h-3 text-purple-500" /> Randevu</span>, value: c.appointments },
                                            ].map(s => (
                                                <div key={s.id} className="text-center p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                                    <p className="text-lg font-bold text-gray-900">{s.value}</p>
                                                    <div className="text-[10px] text-gray-400 font-medium">{s.label}</div>
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
                                    <div className="flex flex-col gap-2 min-w-[130px] flex-shrink-0">
                                        {c.status === "active" && (
                                            <button
                                                onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "paused" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-all active:scale-[0.98]"
                                            >
                                                <Pause className="w-4 h-4" /> Durdur
                                            </button>
                                        )}
                                        {c.status === "paused" && (
                                            <button
                                                onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "active" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-[0.98]"
                                            >
                                                <Play className="w-4 h-4" /> Devam
                                            </button>
                                        )}
                                        {c.status === "draft" && (
                                            <button
                                                onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "active" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl btn-primary text-xs font-bold transition-all active:scale-[0.98]"
                                            >
                                                <Play className="w-4 h-4" /> Başlat
                                            </button>
                                        )}
                                        {/* Voice Demo Button */}
                                        <button
                                            onClick={() => setVoiceDemoCampaign(c)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#CCFF00] text-xs font-bold border border-slate-800 hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(204,255,0,0.15)] transition-all active:scale-[0.98] group"
                                        >
                                            <Headphones className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                            Sesli Demo
                                        </button>

                                        <div className="flex gap-2 w-full mt-auto">
                                            <button
                                                onClick={() => setSelectedCampaign(c)}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                                            >
                                                Detay
                                            </button>
                                            {c.status !== "active" && (
                                                <button
                                                    onClick={() => setCampaignList(prev => prev.filter(camp => camp.id !== c.id))}
                                                    className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all active:scale-[0.98]"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
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
                                <label className="text-sm font-semibold text-gray-700 mb-1.5 flex justify-between">
                                    <span>Numara Listesi / Dosya Yükle</span>
                                    {uploadedFile && (
                                        <button onClick={removeFile} className="text-red-500 hover:text-red-700 text-xs font-bold">
                                            Kaldır
                                        </button>
                                    )}
                                </label>

                                <input
                                    type="file"
                                    accept=".csv, .txt, .xlsx, .xls"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />

                                {!uploadedFile ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-[#CCFF00] hover:bg-[#CCFF00]/5 transition-all group"
                                    >
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-[#CCFF00]/20 transition-colors">
                                            <Upload className="w-6 h-6 text-gray-400 group-hover:text-lime-600 transition-colors" />
                                        </div>
                                        <p className="text-sm text-gray-700 font-bold">CSV veya Excel dosyası yükleyin</p>
                                        <p className="text-xs text-gray-500 mt-1">Seçmek için tıklayın (Her satırda bir numara olmalı)</p>
                                    </div>
                                ) : (
                                    <div className="border border-emerald-100 bg-emerald-50 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{uploadedFile.name}</p>
                                                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                                                    {isUploading ? (
                                                        <span className="flex items-center gap-1"><div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Analiz ediliyor...</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {numberCount} numara aktarıma hazır</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xs font-mono text-gray-400">
                                            {(uploadedFile.size / 1024).toFixed(1)} KB
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Twilio Selection */}
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                                    <span>Twilio Numarası</span>
                                    <span className="text-[10px] bg-slate-900 text-[#CCFF00] px-2 py-0.5 rounded-full uppercase tracking-widest">ElevenLabs</span>
                                </label>
                                {phoneNumbers.length > 0 ? (
                                    <select 
                                        className="input-base"
                                        value={selectedPhone}
                                        onChange={e => setSelectedPhone(e.target.value)}
                                    >
                                        {phoneNumbers.map(p => (
                                            <option key={p.phone_number_id} value={p.phone_number_id}>{p.phone_number} {p.label ? `(${p.label})` : ""}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl flex items-start gap-3">
                                        <XCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-orange-800">Bağlanmış numara bulunamadı.</p>
                                            <p className="text-[10px] text-orange-600 mt-0.5 font-medium leading-relaxed">
                                                Outbound aramalar başlatabilmek için ElevenLabs panelinden Twilio numaranızı içe aktarmanız gerekmektedir.
                                            </p>
                                            <button className="mt-2 text-xs font-bold bg-white text-orange-600 px-3 py-1.5 rounded-lg border border-orange-200">
                                                Nasıl Eklenir?
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Arama Limiti Belirle</label>
                                <div className="grid grid-cols-4 gap-2 mb-2">
                                    {[20, 50, 100, 500].map(limit => (
                                        <button 
                                            key={limit}
                                            onClick={() => setDailyLimit(limit)}
                                            className={cn(
                                                "py-2 rounded-xl text-xs font-bold transition-all border",
                                                dailyLimit === limit ? "bg-slate-900 text-[#CCFF00] border-slate-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                            )}
                                        >
                                            {limit}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Özel miktar:</span>
                                    <input 
                                        className="input-base py-1.5 text-sm" 
                                        type="number" 
                                        value={dailyLimit} 
                                        onChange={(e) => setDailyLimit(parseInt(e.target.value) || 0)} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={handleCloseModal}
                                className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                                İptal
                            </button>
                            <button onClick={handleSaveCampaign}
                                className="flex-1 py-3 rounded-2xl btn-primary text-sm">
                                Kampanyayı Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Campaign Detail Modal */}
            {selectedCampaign && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 xl:p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden relative">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-slate-50/50 flex-shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", statusConfig[selectedCampaign.status].dot)} />
                                    <span className={cn("text-xs font-bold", statusConfig[selectedCampaign.status].cls)}>{statusConfig[selectedCampaign.status].label}</span>
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedCampaign.name}</h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">Oluşturulma: {selectedCampaign.createdAt}</p>
                            </div>
                            <button
                                onClick={() => setSelectedCampaign(null)}
                                className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-500" /> Kampanya Özeti
                            </h3>

                            {/* Detailed Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                                {[
                                    { label: "Toplam Numara", value: selectedCampaign.total, icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
                                    { label: "Aranan Numara", value: selectedCampaign.called, icon: Phone, color: "text-indigo-500", bg: "bg-indigo-50" },
                                    { label: "Sıcak Lead", value: selectedCampaign.hot, icon: Flame, color: "text-orange-500", bg: "bg-orange-50" },
                                    { label: "Kazanılan Randevu", value: selectedCampaign.appointments, icon: CalendarCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
                                ].map((s, i) => (
                                    <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                                                <s.icon className={cn("w-5 h-5", s.color)} />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                                        </div>
                                        <p className="text-3xl font-black text-slate-900">{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Sub Details Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                                {/* Arama İlerlemesi */}
                                <div className="bg-slate-50 rounded-3xl p-6 border border-gray-100">
                                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-[#CCFF00]" /> Arama İlerlemesi
                                    </h4>

                                    <div className="relative pt-8 pb-4">
                                        <div className="flex items-end justify-between mb-2">
                                            <span className="text-4xl font-black text-slate-900 tracking-tighter">%{selectedCampaign.progress}</span>
                                            <span className="text-sm font-semibold text-slate-500 mb-1">{selectedCampaign.total - selectedCampaign.called} numara kaldı</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                            <div className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-400 to-[#CCFF00]"
                                                style={{ width: `${selectedCampaign.progress}%` }} />
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between text-xs font-semibold text-slate-500 bg-white p-4 rounded-2xl border border-gray-100">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Ulaşılan: {selectedCampaign.answered}</div>
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400" /> Cevapsız: {selectedCampaign.called - selectedCampaign.answered}</div>
                                    </div>
                                </div>

                                {/* Son Aramalar (Mock Data for Demo) */}
                                <div className="bg-white rounded-3xl p-6 border border-gray-100">
                                    <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
                                        Son İşlemler
                                        <button className="text-[10px] text-blue-600 font-bold hover:underline">Tümünü İndir (CSV)</button>
                                    </h4>

                                    <div className="space-y-3">
                                        {[
                                            { phone: "+90 532 111 22 33", dur: "1m 45s", tag: "hot" },
                                            { phone: "+90 541 222 33 44", dur: "3m 12s", tag: "appointment" },
                                            { phone: "+90 544 333 44 55", dur: "45s", tag: "cold" },
                                            { phone: "+90 505 444 55 66", dur: "0s", tag: "missed" },
                                        ].map((call, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-gray-100 group cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-900">{call.phone}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">Süre: {call.dur}</p>
                                                    </div>
                                                </div>
                                                <span className={cn("text-[10px] px-2 py-1 rounded-md font-bold",
                                                    call.tag === 'hot' ? 'bg-orange-100 text-orange-600' :
                                                        call.tag === 'appointment' ? 'bg-emerald-100 text-emerald-600' :
                                                            call.tag === 'cold' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                                                )}>
                                                    {call.tag === 'hot' ? 'Sıcak' : call.tag === 'appointment' ? 'Randevu' : call.tag === 'cold' ? 'Soğuk' : 'Cevapsız'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Agent Prompt Editor Integration */}
                            <div className="mt-8">
                                <AgentPromptEditor 
                                    agentId={selectedCampaign.agentId} 
                                    agentRole={selectedCampaign.agentRole} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Voice Agent Demo Modal */}
            <VoiceAgentDemoModal
                isOpen={voiceDemoCampaign !== null}
                onClose={() => setVoiceDemoCampaign(null)}
                campaignName={voiceDemoCampaign?.name || ""}
                agentId={voiceDemoCampaign?.agentId}
                agentRole={voiceDemoCampaign?.agentRole}
            />
        </div>
    );
};
