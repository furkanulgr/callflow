import { useState } from "react";
import {
    Sparkles, Phone, Bell, Clock, User, Save,
    Volume2, Globe, Shield, ChevronRight, Building
} from "lucide-react";
import { cn } from "@/utils/cn";

type Section = "ai" | "calls" | "notifications" | "hours" | "account";

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
    const [voice, setVoice] = useState("female-tr");
    const [greeting, setGreeting] = useState("Merhaba, VMS Digital'e hoş geldiniz. Size nasıl yardımcı olabilirim?");
    const [autoAnswer, setAutoAnswer] = useState(true);
    const [recordCalls, setRecordCalls] = useState(true);
    const [callSummary, setCallSummary] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [missedAlert, setMissedAlert] = useState(true);
    const [hotAlert, setHotAlert] = useState(true);
    const [workHours, setWorkHours] = useState(true);
    const [workStart, setWorkStart] = useState("09:00");
    const [workEnd, setWorkEnd] = useState("18:00");

    const sections: { id: Section; label: string; Icon: React.ElementType }[] = [
        { id: "ai", label: "AI Asistan", Icon: Sparkles },
        { id: "calls", label: "Çağrı Ayarları", Icon: Phone },
        { id: "notifications", label: "Bildirimler", Icon: Bell },
        { id: "hours", label: "Çalışma Saatleri", Icon: Clock },
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
                                                <button key={v.id} onClick={() => setVoice(v.id)}
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
                                        <textarea rows={3} value={greeting} onChange={e => setGreeting(e.target.value)}
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
                                        <SettingRow label="Otomatik Yanıtlama" desc="Gelen çağrıları AI otomatik yanıtlasın" enabled={autoAnswer} onChange={setAutoAnswer} />
                                        <SettingRow label="Çağrı Kaydı" desc="Tüm çağrıları kaydet ve sakla" enabled={recordCalls} onChange={setRecordCalls} />
                                        <SettingRow label="AI Özet Oluştur" desc="Her çağrı sonunda AI özeti hazırlansın" enabled={callSummary} onChange={setCallSummary} />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Günlük Max. Arama Sayısı</label>
                                        <input type="number" defaultValue={100} className="input-base w-40" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Çağrılar Arası Bekleme (sn)</label>
                                        <input type="number" defaultValue={30} className="input-base w-40" />
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
                                        <SettingRow label="Anlık Bildirimler" desc="Yeni çağrı ve mesajlar için bildir" enabled={notifications} onChange={setNotifications} />
                                        <SettingRow label="Cevapsız Çağrı Uyarısı" desc="Cevapsız çağrılar için bildirim gönder" enabled={missedAlert} onChange={setMissedAlert} />
                                        <SettingRow label="Sıcak Lead Uyarısı" desc="Sıcak lead tespit edildiğinde uyar" enabled={hotAlert} onChange={setHotAlert} />
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
                                        <SettingRow label="Çalışma Saatleri Modu" desc="Mesai dışında farklı mesaj kullan" enabled={workHours} onChange={setWorkHours} />
                                    </div>

                                    {workHours && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Başlangıç</label>
                                                <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="input-base" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-gray-700 mb-2 block">Bitiş</label>
                                                <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="input-base" />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Çalışılan Günler</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d, i) => (
                                                <button key={d}
                                                    className={cn("w-12 h-10 rounded-xl text-xs font-bold transition-all",
                                                        i < 5 ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200")}>
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
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
                                            <p className="font-bold text-gray-900">Görkem</p>
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
                            <div className="mt-8 flex justify-end">
                                <button className="flex items-center gap-2 px-6 py-3 rounded-xl btn-primary text-sm">
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
