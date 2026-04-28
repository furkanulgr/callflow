import { useState, useEffect } from "react";
import {
    Sparkles, Phone, Bell, Clock, User, Save,
    Volume2, Globe, Shield, ChevronRight, Building, CheckCircle2,
    Zap, Puzzle, Copy, RefreshCw, Loader2, Trash2, ArrowUpRight, Key,
} from "lucide-react";
import { cn } from "@/utils/cn";
import {
    getLeadflowKey, generateLeadflowKey, revokeLeadflowKey,
    LeadflowConnection,
} from "@/services/leadflowApi";

const STORAGE_KEY = "callflow_settings";

interface SettingsState {
    voice: string;
    greeting: string;
    autoAnswer: boolean;
    recordCalls: boolean;
    callSummary: boolean;
    notifications: boolean;
    missedAlert: boolean;
    hotAlert: boolean;
    workHours: boolean;
    workStart: string;
    workEnd: string;
    workDays: number[];
    dailyMax: number;
    callDelay: number;
    leadflowEnabled: boolean;
    leadflowUrl: string;
}

const DEFAULTS: SettingsState = {
    voice: "female-tr",
    greeting: "Merhaba, LUERA'ya hoş geldiniz. Size nasıl yardımcı olabilirim?",
    autoAnswer: true,
    recordCalls: true,
    callSummary: true,
    notifications: true,
    missedAlert: true,
    hotAlert: true,
    workHours: true,
    workStart: "09:00",
    workEnd: "18:00",
    workDays: [0, 1, 2, 3, 4],
    dailyMax: 100,
    callDelay: 30,
    leadflowEnabled: true,
    leadflowUrl: "https://leadflow.lueratech.com",
};

function loadSettings(): SettingsState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULTS;
}

type Section = "ai" | "calls" | "notifications" | "hours" | "account" | "integrations";

const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!enabled)}
        className={cn("relative w-12 h-6 rounded-full toggle-track flex-shrink-0 transition-colors duration-300",
            enabled ? "bg-[#CCFF00]" : "bg-gray-200")}>
        <div className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm toggle-thumb",
            enabled ? "left-[26px]" : "left-[2px]")} />
    </button>
);

export const SettingsPage = () => {
    const [section, setSection] = useState<Section>("ai");
    const [saved, setSaved] = useState(false);
    const [s, setS] = useState<SettingsState>(loadSettings);

    // LeadFlow API Key state
    const [lfKey, setLfKey]             = useState<LeadflowConnection | null>(null);
    const [lfKeyLoading, setLfKeyLoading] = useState(false);
    const [lfKeyCopied, setLfKeyCopied]   = useState(false);
    const [lfKeyVisible, setLfKeyVisible] = useState(false);
    const [lfGenerating, setLfGenerating] = useState(false);
    const [lfRevoking, setLfRevoking]     = useState(false);
    const [lfKeyError, setLfKeyError]     = useState<string | null>(null);

    useEffect(() => {
        if (section === "integrations") {
            setLfKeyLoading(true);
            getLeadflowKey()
                .then(key => setLfKey(key))
                .catch(() => setLfKeyError("Key bilgisi alınamadı"))
                .finally(() => setLfKeyLoading(false));
        }
    }, [section]);

    const handleGenerateKey = async () => {
        setLfGenerating(true);
        setLfKeyError(null);
        try {
            const key = await generateLeadflowKey();
            setLfKey(key);
            setLfKeyVisible(true);
        } catch (err: any) {
            console.error("[generateLeadflowKey] Hata:", err);
            setLfKeyError(`Key oluşturulamadı: ${err?.message ?? "bilinmeyen hata"}`);
        } finally {
            setLfGenerating(false);
        }
    };

    const handleRevokeKey = async () => {
        if (!confirm("Bu API key'i iptal etmek istediğinizden emin misiniz? LeadFlow bağlantısı kesilir.")) return;
        setLfRevoking(true);
        try {
            await revokeLeadflowKey();
            setLfKey(null);
            setLfKeyVisible(false);
        } catch {
            setLfKeyError("Key iptal edilemedi.");
        } finally {
            setLfRevoking(false);
        }
    };

    const handleCopyKey = () => {
        if (!lfKey?.api_key) return;
        navigator.clipboard.writeText(lfKey.api_key);
        setLfKeyCopied(true);
        setTimeout(() => setLfKeyCopied(false), 2000);
    };

    const set = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
        setS(prev => ({ ...prev, [key]: value }));

    const toggleWorkDay = (i: number) =>
        setS(prev => ({
            ...prev,
            workDays: prev.workDays.includes(i)
                ? prev.workDays.filter(d => d !== i)
                : [...prev.workDays, i],
        }));

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        window.dispatchEvent(new Event("callflow_settings_updated"));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    // Destructure for convenience
    const { voice, greeting, autoAnswer, recordCalls, callSummary,
            notifications, missedAlert, hotAlert, workHours, workStart, workEnd } = s;

    const sections: { id: Section; label: string; Icon: React.ElementType }[] = [
        { id: "ai", label: "AI Asistan", Icon: Sparkles },
        { id: "calls", label: "Çağrı Ayarları", Icon: Phone },
        { id: "notifications", label: "Bildirimler", Icon: Bell },
        { id: "hours", label: "Çalışma Saatleri", Icon: Clock },
        { id: "integrations", label: "Entegrasyonlar", Icon: Puzzle },
        { id: "account", label: "Hesap", Icon: User },
    ];

    const SettingRow = ({ label, desc, enabled, onChange }: { label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void }) => (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
            <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <Toggle enabled={enabled} onChange={onChange} />
        </div>
    );

    return (
        <div className="min-h-screen p-6 md:p-8 bg-slate-50/50">
            <div className="max-w-[1100px] mx-auto space-y-6">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Ayarlar</h1>
                    <p className="text-sm text-gray-500 mt-1">AI asistanı ve sistemi yapılandırın</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl p-3 card">
                            {sections.map(s => {
                                const isActive = section === s.id;
                                const Icon = s.Icon;
                                return (
                                    <button key={s.id} onClick={() => setSection(s.id)}
                                        className={cn("relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all",
                                            isActive ? "nav-active" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800")}>
                                        {isActive && <div className="nav-active-bar" />}
                                        <Icon size={17} className={isActive ? "text-gray-900" : "text-gray-500"} />
                                        <span>{s.label}</span>
                                        {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-3xl p-6 card">

                            {/* AI */}
                            {section === "ai" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-gray-900" /> AI Asistan Ayarları
                                    </h2>

                                    {/* Voice */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-3 block">Ses Seçimi</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: "female-tr", label: "Kadın (Türkçe)", desc: "Doğal ve sıcak ton" },
                                                { id: "male-tr", label: "Erkek (Türkçe)", desc: "Profesyonel ton" },
                                                { id: "female-en", label: "Female (English)", desc: "Natural & warm" },
                                                { id: "male-en", label: "Male (English)", desc: "Professional tone" },
                                            ].map(v => (
                                                <button key={v.id} onClick={() => set("voice", v.id)}
                                                    className={cn("p-4 rounded-2xl border text-left transition-all",
                                                        voice === v.id ? "border-[#CCFF00] bg-[#CCFF00]/10 shadow-sm ring-1 ring-[#CCFF00]/30" : "border-gray-200 hover:border-slate-300 bg-white")}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Volume2 className={cn("w-4 h-4", voice === v.id ? "text-[#4d7c0f]" : "text-gray-400")} />
                                                        <span className={cn("text-sm font-semibold", voice === v.id ? "text-[#3d6209]" : "text-gray-900")}>{v.label}</span>
                                                    </div>
                                                    <p className={cn("text-xs", voice === v.id ? "text-[#4d7c0f]/70" : "text-gray-400")}>{v.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Greeting */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Karşılama Mesajı</label>
                                        <textarea rows={3} value={greeting} onChange={e => set("greeting", e.target.value)}
                                            className="input-base resize-none" />
                                        <p className="text-xs text-gray-400 mt-1">AI, çağrıyı yanıtladığında söyleyeceği ilk cümle</p>
                                    </div>

                                    {/* Language */}
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Ana Dil</label>
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50">
                                            <Globe className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">Türkçe</span>
                                            <span className="text-xs text-gray-400 ml-auto">Varsayılan</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Calls */}
                            {section === "calls" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Phone className="w-5 h-5 text-blue-500" /> Çağrı Ayarları
                                    </h2>
                                    <div className="space-y-3">
                                        <SettingRow label="Otomatik Yanıtlama" desc="Gelen çağrıları AI otomatik yanıtlasın" enabled={autoAnswer} onChange={v => set("autoAnswer", v)} />
                                        <SettingRow label="Çağrı Kaydı" desc="Tüm çağrıları kaydet ve sakla" enabled={recordCalls} onChange={v => set("recordCalls", v)} />
                                        <SettingRow label="AI Özet Oluştur" desc="Her çağrı sonunda AI özeti hazırlansın" enabled={callSummary} onChange={v => set("callSummary", v)} />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Günlük Max. Arama Sayısı</label>
                                        <input type="number" value={s.dailyMax} onChange={e => set("dailyMax", parseInt(e.target.value) || 0)} className="input-base w-40" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Çağrılar Arası Bekleme (sn)</label>
                                        <input type="number" value={s.callDelay} onChange={e => set("callDelay", parseInt(e.target.value) || 0)} className="input-base w-40" />
                                    </div>
                                </div>
                            )}

                            {/* Notifications */}
                            {section === "notifications" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Bell className="w-5 h-5 text-amber-500" /> Bildirim Ayarları
                                    </h2>
                                    <div className="space-y-3">
                                        <SettingRow label="Anlık Bildirimler" desc="Yeni çağrı ve mesajlar için bildir" enabled={notifications} onChange={v => set("notifications", v)} />
                                        <SettingRow label="Cevapsız Çağrı Uyarısı" desc="Cevapsız çağrılar için bildirim gönder" enabled={missedAlert} onChange={v => set("missedAlert", v)} />
                                        <SettingRow label="Sıcak Lead Uyarısı" desc="Sıcak lead tespit edildiğinde uyar" enabled={hotAlert} onChange={v => set("hotAlert", v)} />
                                    </div>
                                </div>
                            )}

                            {/* Work Hours */}
                            {section === "hours" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-emerald-500" /> Çalışma Saatleri
                                    </h2>
                                    <div className="space-y-3">
                                        <SettingRow label="Çalışma Saatleri Modu" desc="Mesai dışında farklı mesaj kullan" enabled={workHours} onChange={v => set("workHours", v)} />
                                    </div>

                                    {workHours && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Başlangıç</label>
                                                <input type="time" value={workStart} onChange={e => set("workStart", e.target.value)} className="input-base" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Bitiş</label>
                                                <input type="time" value={workEnd} onChange={e => set("workEnd", e.target.value)} className="input-base" />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Çalışılan Günler</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d, i) => (
                                                <button key={d} onClick={() => toggleWorkDay(i)}
                                                    className={cn("w-12 h-10 rounded-xl text-xs font-bold transition-all",
                                                        s.workDays.includes(i) ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}>
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Integrations */}
                            {section === "integrations" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Puzzle className="w-5 h-5 text-gray-500" /> Entegrasyonlar
                                    </h2>

                                    {/* LeadFlow Card */}
                                    <div className={cn(
                                        "rounded-2xl border-2 p-5 transition-all",
                                        s.leadflowEnabled
                                            ? "border-[#CCFF00]/50 bg-[#CCFF00]/5"
                                            : "border-gray-200 bg-gray-50"
                                    )}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                                    s.leadflowEnabled ? "bg-slate-900" : "bg-gray-200"
                                                )}>
                                                    <Zap className={cn("w-5 h-5", s.leadflowEnabled ? "text-[#CCFF00]" : "text-gray-400")} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">LUERA LeadFlow</p>
                                                    <p className="text-xs text-gray-500">Google Maps lead bulma motoru</p>
                                                </div>
                                            </div>
                                            <Toggle enabled={s.leadflowEnabled} onChange={v => set("leadflowEnabled", v)} />
                                        </div>

                                        {s.leadflowEnabled && (
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">LeadFlow URL</label>
                                                <input
                                                    type="text"
                                                    value={s.leadflowUrl}
                                                    onChange={e => set("leadflowUrl", e.target.value)}
                                                    className="input-base text-sm font-mono"
                                                    placeholder="https://leadflow.lueratech.com"
                                                />
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    Aktif olduğunda sidebar'da LeadFlow butonu görünür
                                                </p>
                                            </div>
                                        )}

                                        {!s.leadflowEnabled && (
                                            <p className="text-xs text-gray-400">
                                                Pasif — LeadFlow butonu sidebar'da gizlenir
                                            </p>
                                        )}
                                    </div>

                                    {/* LeadFlow API Key Card */}
                                    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                                                <Key className="w-5 h-5 text-[#CCFF00]" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">LeadFlow Bağlantı Anahtarı</p>
                                                <p className="text-xs text-gray-500">Bu key'i LeadFlow ayarlarına girerek lead aktarımını etkinleştir</p>
                                            </div>
                                        </div>

                                        {lfKeyLoading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                            </div>
                                        ) : lfKey ? (
                                            <div className="space-y-3">
                                                {/* Key göster / gizle */}
                                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                    <code className="flex-1 text-xs font-mono text-slate-700 truncate select-all">
                                                        {lfKeyVisible ? lfKey.api_key : `${lfKey.api_key.slice(0, 8)}${'•'.repeat(24)}${lfKey.api_key.slice(-4)}`}
                                                    </code>
                                                    <button
                                                        onClick={() => setLfKeyVisible(v => !v)}
                                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors flex-shrink-0"
                                                    >
                                                        {lfKeyVisible ? "Gizle" : "Göster"}
                                                    </button>
                                                </div>

                                                {/* Aksiyon butonları */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleCopyKey}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                                                            lfKeyCopied
                                                                ? "bg-emerald-500 text-white"
                                                                : "bg-slate-900 text-[#CCFF00] hover:bg-slate-700"
                                                        )}
                                                    >
                                                        {lfKeyCopied ? <><CheckCircle2 className="w-4 h-4" /> Kopyalandı</> : <><Copy className="w-4 h-4" /> Kopyala</>}
                                                    </button>
                                                    <button
                                                        onClick={handleGenerateKey}
                                                        disabled={lfGenerating}
                                                        title="Yeni key üret (eskisi geçersiz olur)"
                                                        className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
                                                    >
                                                        <RefreshCw className={cn("w-4 h-4", lfGenerating && "animate-spin")} />
                                                    </button>
                                                    <button
                                                        onClick={handleRevokeKey}
                                                        disabled={lfRevoking}
                                                        title="Key'i iptal et"
                                                        className="px-3 py-2.5 rounded-xl border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Kullanım bilgisi */}
                                                <div className="text-[11px] text-slate-400 space-y-1 pt-1">
                                                    <p>Oluşturulma: {new Date(lfKey.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</p>
                                                    {lfKey.last_used_at && <p>Son kullanım: {new Date(lfKey.last_used_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</p>}
                                                </div>

                                                {/* LeadFlow'da nasıl kullanılır */}
                                                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <p className="text-[11px] font-bold text-slate-600 mb-1">LeadFlow'da nasıl kullanılır?</p>
                                                    <p className="text-[11px] text-slate-500">LeadFlow → Ayarlar → CallFlow Entegrasyonu → Bu key'i gir</p>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <code className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 font-mono text-slate-600 flex-1 truncate">
                                                            {import.meta.env['VITE_BRIDGE_SERVER_URL'] ?? 'https://callflow-production-3ce4.up.railway.app'}/api/leadflow/receive
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p className="text-sm text-slate-500 text-center py-2">
                                                    Henüz bir API key oluşturulmamış.
                                                </p>
                                                <button
                                                    onClick={handleGenerateKey}
                                                    disabled={lfGenerating}
                                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-[#CCFF00] font-bold text-sm hover:bg-slate-700 transition-colors disabled:opacity-50"
                                                >
                                                    {lfGenerating
                                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Oluşturuluyor...</>
                                                        : <><Key className="w-4 h-4" /> API Key Oluştur</>
                                                    }
                                                </button>
                                            </div>
                                        )}

                                        {lfKeyError && (
                                            <p className="mt-3 text-xs text-red-500 font-medium">{lfKeyError}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Account */}
                            {section === "account" && (
                                <div className="space-y-6">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <User className="w-5 h-5 text-gray-500" /> Hesap Bilgileri
                                    </h2>

                                    <div className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                                            style={{ background: "linear-gradient(135deg,#CCFF00,#a3e635)", color: "#1a1a1a" }}>
                                            G
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Gökhan</p>
                                            <p className="text-xs text-gray-500 mt-0.5">gorkem@vmsdigital.com</p>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#CCFF00]/15 text-[#4d7c0f] border border-[#CCFF00]/30 mt-1">Admin</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Şirket Adı</label>
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50">
                                            <Building className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">LUERA</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">API Anahtarı</label>
                                        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50">
                                            <Shield className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-400 font-mono">sk_••••••••••••••••••••••••</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Save */}
                            <div className="mt-8 flex items-center justify-end gap-3">
                                {saved && (
                                    <span className="flex items-center gap-1.5 text-sm font-semibold text-[#4d7c0f]">
                                        <CheckCircle2 className="w-4 h-4" /> Kaydedildi!
                                    </span>
                                )}
                                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-sm">
                                    <Save className="w-4 h-4" /> Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
