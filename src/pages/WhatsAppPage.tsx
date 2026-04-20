import { useState, useEffect, useCallback } from "react";
import {
    MessageSquare, CheckCircle2, Clock, XCircle,
    RefreshCw, Send, Flame, Snowflake, CalendarCheck,
    Plus, Trash2, Edit2, Zap, X, Star, StarOff, Loader2,
    AlertTriangle, Eye, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";

/* ── Types ─────────────────────────────────────────────────── */
interface WaTemplate {
    id: string;
    name: string;
    trigger_type: string;
    message: string;
    is_active: boolean;
    created_at: string;
}

/* ── Hazır Şablonlar ───────────────────────────────────────── */
const STARTER_TEMPLATES = [
    {
        name: "Randevu Teyidi",
        trigger_type: "appointment",
        emoji: "📅",
        message: `━━━━━━━━━━━━━━━━━━━━━
🤖 *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 👋

Görüşmeniz başarıyla tamamlandı, randevunuz onaylandı! ✅
⏱ Görüşme süresi: _{{sure}}_

📅 *Randevu Bilgileriniz*
──────────────────────
📆 Tarih: *{{randevu_tarihi}}*
🕐 Saat: *{{randevu_saati}}*
📍 Adres: {{randevu_adresi}}

Herhangi bir sorunuz için bizi aramaktan çekinmeyin. 🙏

_Görüşmek üzere!_
*LUERA Ekibi*`,
    },
    {
        name: "Sıcak Lead Takip",
        trigger_type: "hot",
        emoji: "🔥",
        message: `━━━━━━━━━━━━━━━━━━━━━
🔥 *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 👋

Az önce yaptığımız görüşme için teşekkürler! 🙏
⏱ Görüşme süresi: _{{sure}}_

Size özel hazırladığımız *özel teklifimizi* paylaşmak isteriz.

📞 *Sizi en kısa sürede tekrar arayacağız!*

Sorularınız için bizi aramaktan çekinmeyin. 😊

_İyi günler!_
*LUERA Ekibi*`,
    },
    {
        name: "Demo Daveti",
        trigger_type: "hot",
        emoji: "🎯",
        message: `━━━━━━━━━━━━━━━━━━━━━
🎯 *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 🌟

Az önce harika bir görüşme yaptık, teşekkürler! ✨
⏱ Görüşme süresi: _{{sure}}_

Size özel *ürün demomuzu* göstermek isteriz.

📅 *Demo Randevunuz*
──────────────────────
📆 Tarih: *{{randevu_tarihi}}*
🕐 Saat: *{{randevu_saati}}*

*Görüşmek üzere!* 🚀

_Herhangi bir sorunuz olursa lütfen bizi arayın._
*LUERA Ekibi*`,
    },
    {
        name: "Randevu Hatırlatıcı",
        trigger_type: "appointment",
        emoji: "⏰",
        message: `━━━━━━━━━━━━━━━━━━━━━
⏰ *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 👋

Yaklaşan randevunuzu hatırlatmak istedik. 📌

📅 *Randevu Bilgileriniz*
──────────────────────
📆 Tarih: *{{randevu_tarihi}}*
🕐 Saat: *{{randevu_saati}}*
📍 Adres: {{randevu_adresi}}

Değişiklik veya iptal için lütfen bizi önceden arayın.

_Görüşmek üzere!_ 👋
*LUERA Ekibi*`,
    },
    {
        name: "Soğuk Lead — 3 Ay Sonra",
        trigger_type: "cold",
        emoji: "❄️",
        message: `━━━━━━━━━━━━━━━━━━━━━
❄️ *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 😊

Sizi bir süre önce aramıştık. Umarım iyisinizdir.

*Yeni hizmetlerimiz ve özel fırsatlarımız* hazır!

📞 *Kısa bir görüşme ayarlayabilir miyiz?*
Uygun bir zaman söyleyin, sizi hemen arayalım. 🙏

_İyi günler dileriz!_
*LUERA Ekibi*`,
    },
    {
        name: "Teşekkür & Geri Bildirim",
        trigger_type: "appointment",
        emoji: "⭐",
        message: `━━━━━━━━━━━━━━━━━━━━━
⭐ *LUERA CallFlow*
━━━━━━━━━━━━━━━━━━━━━

Merhaba *{{isim}}!* 😊

Bugünkü görüşmemiz için çok teşekkür ederiz! ⭐
⏱ Görüşme süresi: _{{sure}}_

*Deneyiminizi değerlendirmek ister misiniz?*

👍 Memnun kaldıysanız bize bildirin!
Sizi özel kampanyalarımızdan ilk haberdar edelim. 🎁

_İyi günler dileriz, görüşmek üzere!_ 🙏
*LUERA Ekibi*`,
    },
];

/* ── Constants ─────────────────────────────────────────────── */
const VARIABLES = [
    { key: "{{isim}}",             label: "Müşteri Adı" },
    { key: "{{randevu_tarihi}}",   label: "Randevu Tarihi" },
    { key: "{{randevu_saati}}",    label: "Randevu Saati" },
    { key: "{{randevu_adresi}}",   label: "Adres" },
    { key: "{{sure}}",             label: "Görüşme Süresi" },
];

const TRIGGER_CONFIG: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    hot:         { cls: "bg-orange-100/80 text-orange-700 border-orange-200",   label: "Sıcak Lead",  icon: <Flame       className="w-3 h-3 fill-orange-500 text-orange-600" /> },
    cold:        { cls: "bg-blue-100/80 text-blue-700 border-blue-200",         label: "Soğuk Lead",  icon: <Snowflake   className="w-3 h-3 text-blue-600" /> },
    appointment: { cls: "bg-emerald-100/80 text-emerald-700 border-emerald-200",label: "Randevu",     icon: <CalendarCheck className="w-3 h-3 text-emerald-600" /> },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    sent:    { label: "Gönderildi", cls: "bg-emerald-100/80 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
    pending: { label: "Bekliyor",   cls: "bg-amber-100/80 text-amber-800 border-amber-200",       icon: <Clock        className="w-3 h-3" /> },
    failed:  { label: "Başarısız",  cls: "bg-red-100/80 text-red-700 border-red-200",             icon: <XCircle      className="w-3 h-3" /> },
};

const EMPTY_FORM = { name: "", trigger_type: "appointment", message: "" };

/* ── Preview helper ─────────────────────────────────────────── */
function previewMessage(msg: string) {
    return msg
        .replace(/\{\{isim\}\}/g,            "Ahmet Bey")
        .replace(/\{\{randevu_tarihi\}\}/g,  "Yarın, Perşembe")
        .replace(/\{\{randevu_saati\}\}/g,   "16:00")
        .replace(/\{\{randevu_adresi\}\}/g,  "Bağcılar Mah. No:12, İstanbul")
        .replace(/\{\{adres\}\}/g,           "Bağcılar Mah. No:12, İstanbul")
        .replace(/\{\{sure\}\}/g,            "2 dk 15 sn");
}

/* ══════════════════════════════════════════════════════════════ */
export const WhatsAppPage = () => {
    const [templates, setTemplates]     = useState<WaTemplate[]>([]);
    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [error, setError]             = useState<string | null>(null);

    const [activeTab, setActiveTab]     = useState<"templates" | "queue">("templates");
    const [showModal, setShowModal]     = useState(false);
    const [editTarget, setEditTarget]   = useState<WaTemplate | null>(null);
    const [form, setForm]               = useState(EMPTY_FORM);
    const [preview, setPreview]         = useState(false);
    const [expandedId, setExpandedId]   = useState<string | null>(null);

    /* ── Fetch templates ─────────────────────────────────────── */
    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("whatsapp_templates")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) setError(error.message);
        else setTemplates(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    /* ── Open modal ─────────────────────────────────────────── */
    const openNew  = () => { setEditTarget(null); setForm(EMPTY_FORM); setPreview(false); setShowModal(true); };
    const openEdit = (t: WaTemplate) => {
        setEditTarget(t);
        setForm({ name: t.name, trigger_type: t.trigger_type, message: t.message });
        setPreview(false);
        setShowModal(true);
    };

    /* ── Save template ──────────────────────────────────────── */
    const handleSave = async () => {
        if (!form.name.trim() || !form.message.trim()) return;
        setSaving(true);
        setError(null);
        try {
            if (editTarget) {
                const { error } = await supabase
                    .from("whatsapp_templates")
                    .update({ name: form.name, trigger_type: form.trigger_type, message: form.message })
                    .eq("id", editTarget.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("whatsapp_templates")
                    .insert({ ...form, is_active: false });
                if (error) throw error;
            }
            setShowModal(false);
            fetchTemplates();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    /* ── Set active ─────────────────────────────────────────── */
    const handleSetActive = async (id: string) => {
        // Önce hepsini pasif yap
        await supabase.from("whatsapp_templates").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
        // Sonra seçileni aktif yap
        await supabase.from("whatsapp_templates").update({ is_active: true }).eq("id", id);
        fetchTemplates();
    };

    /* ── Delete ─────────────────────────────────────────────── */
    const handleDelete = async (id: string) => {
        if (!confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;
        await supabase.from("whatsapp_templates").delete().eq("id", id);
        fetchTemplates();
    };

    /* ── Insert variable into textarea ─────────────────────── */
    const insertVariable = (key: string) => {
        setForm(prev => ({ ...prev, message: prev.message + key }));
    };

    const activeTemplate = templates.find(t => t.is_active);

    /* ══════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen p-6 md:p-8 bg-[#FAFAFC] font-sans">
            <div className="max-w-[1200px] mx-auto space-y-7">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">WhatsApp</h1>
                        <p className="text-sm text-slate-500 mt-1">Otomatik mesaj şablonları ve gönderim yönetimi</p>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-emerald-50 border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.05)]">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[13px] font-bold text-emerald-700">WhatsApp Bağlı</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: "Toplam Şablon",   value: templates.length, icon: MessageSquare, color: "text-slate-600",   bg: "bg-slate-50",   accent: "text-slate-800"   },
                        { label: "Aktif Otomasyon",  value: activeTemplate ? 1 : 0, icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50", accent: "text-emerald-700" },
                        { label: "Bekleyen Mesaj",   value: 0,                icon: Clock,         color: "text-amber-500",   bg: "bg-amber-50",   accent: "text-amber-700"   },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4 group hover:shadow-md transition-all">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", s.bg)}>
                                <s.icon className={cn("w-5 h-5", s.color)} />
                            </div>
                            <div>
                                <h3 className={cn("text-2xl font-bold tracking-tight leading-none", s.accent)}>{s.value}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Aktif şablon banner */}
                {activeTemplate && (
                    <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-emerald-800">Aktif Otomasyon: <span className="font-black">{activeTemplate.name}</span></p>
                            <p className="text-xs text-emerald-600 mt-0.5">Arama bitince bu şablon otomatik gönderilir</p>
                        </div>
                        <Send className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    </div>
                )}

                {/* Tabs */}
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
                        <button onClick={openNew} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                            <Plus className="w-4 h-4" /> Yeni Şablon
                        </button>
                    )}
                </div>

                {/* Templates Tab */}
                {activeTab === "templates" && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm font-medium">Şablonlar yükleniyor...</span>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                                <MessageSquare className="w-10 h-10 opacity-30" />
                                <p className="text-sm font-medium">Henüz şablon yok</p>
                                <button onClick={openNew} className="text-xs font-bold text-emerald-600 hover:underline">+ İlk şablonu oluştur</button>
                            </div>
                        ) : templates.map(t => {
                            const trig     = TRIGGER_CONFIG[t.trigger_type] || TRIGGER_CONFIG.appointment;
                            const expanded = expandedId === t.id;
                            return (
                                <div key={t.id} className={cn(
                                    "bg-white rounded-2xl border shadow-[0_5px_20px_rgba(0,0,0,0.02)] transition-all",
                                    t.is_active ? "border-emerald-200 shadow-emerald-50" : "border-slate-100 hover:shadow-md"
                                )}>
                                    <div className="flex items-start gap-4 p-6">
                                        {/* Aktif yıldız */}
                                        <button
                                            onClick={() => handleSetActive(t.id)}
                                            title={t.is_active ? "Aktif şablon" : "Aktif yap"}
                                            className={cn("mt-0.5 flex-shrink-0 p-1.5 rounded-lg transition-all",
                                                t.is_active ? "text-amber-400 bg-amber-50" : "text-slate-200 hover:text-amber-400 hover:bg-amber-50"
                                            )}
                                        >
                                            {t.is_active ? <Star className="w-5 h-5 fill-amber-400" /> : <StarOff className="w-5 h-5" />}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="font-bold text-lg text-slate-800 tracking-tight">{t.name}</h3>
                                                {t.is_active && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        <Zap className="w-3 h-3" /> Aktif
                                                    </span>
                                                )}
                                                <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm", trig.cls)}>
                                                    {trig.icon} {trig.label}
                                                </span>
                                            </div>

                                            {/* Mesaj önizleme */}
                                            <button
                                                onClick={() => setExpandedId(expanded ? null : t.id)}
                                                className="mt-3 w-full text-left group"
                                            >
                                                <div className={cn(
                                                    "bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-3 transition-all",
                                                    expanded ? "border-emerald-100 bg-white" : "group-hover:bg-white group-hover:border-emerald-100"
                                                )}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Eye className="w-3 h-3" /> Önizleme
                                                        </span>
                                                        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                                                    </div>
                                                    <p className={cn("text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap", !expanded && "line-clamp-2")}>
                                                        {previewMessage(t.message)}
                                                    </p>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button onClick={() => openEdit(t)} className="p-2.5 rounded-xl border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all shadow-sm">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(t.id)} className="p-2.5 rounded-xl border border-red-50 text-red-300 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
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
                        <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-3">
                            <Send className="w-8 h-8 opacity-40" />
                            <p className="text-sm font-medium text-slate-400">Henüz gönderim yok</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{editTarget ? "Şablonu Düzenle" : "Yeni Şablon"}</h2>
                                <p className="text-xs text-slate-400 mt-0.5">WhatsApp mesaj şablonu {editTarget ? "düzenle" : "oluştur"}</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-5 overflow-y-auto">
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
                                </div>
                            )}

                            {/* Hazır Şablonlar */}
                            {!editTarget && (
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Hazır Şablonlar</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {STARTER_TEMPLATES.map(s => (
                                            <button
                                                key={s.name}
                                                onClick={() => setForm({ name: s.name, trigger_type: s.trigger_type, message: s.message })}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2.5 rounded-xl text-left border transition-all text-xs font-bold",
                                                    form.name === s.name
                                                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm"
                                                        : "border-slate-100 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50"
                                                )}
                                            >
                                                <span className="text-base">{s.emoji}</span>
                                                <span className="truncate">{s.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 my-4">
                                        <div className="flex-1 h-px bg-slate-100" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">veya sıfırdan oluştur</span>
                                        <div className="flex-1 h-px bg-slate-100" />
                                    </div>
                                </div>
                            )}

                            {/* Şablon Adı */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Şablon Adı</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ör: Randevu Teyidi"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                                />
                            </div>

                            {/* Tetikleyici */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Tetikleyici</label>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { value: "appointment", label: "Randevu",    icon: <CalendarCheck className="w-3.5 h-3.5" />, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                                        { value: "hot",         label: "Sıcak Lead", icon: <Flame          className="w-3.5 h-3.5" />, cls: "bg-orange-50 border-orange-200 text-orange-700" },
                                        { value: "cold",        label: "Soğuk Lead", icon: <Snowflake      className="w-3.5 h-3.5" />, cls: "bg-blue-50 border-blue-200 text-blue-700" },
                                    ].map(opt => (
                                        <button key={opt.value}
                                            onClick={() => setForm(p => ({ ...p, trigger_type: opt.value }))}
                                            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
                                                form.trigger_type === opt.value ? opt.cls + " shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                                            )}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mesaj */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Mesaj İçeriği</label>
                                    <button
                                        onClick={() => setPreview(p => !p)}
                                        className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1",
                                            preview ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <Eye className="w-3 h-3" /> {preview ? "Düzenle" : "Önizle"}
                                    </button>
                                </div>

                                {preview ? (
                                    <div className="w-full min-h-[120px] px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {previewMessage(form.message) || <span className="text-slate-300">Önizlemek için mesaj girin...</span>}
                                    </div>
                                ) : (
                                    <textarea
                                        value={form.message}
                                        onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                        placeholder={"Merhaba {{isim}}! 👋\n\nRandevunuz: {{randevu_tarihi}} saat {{randevu_saati}}\n📍 {{adres}}"}
                                        rows={5}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all resize-none font-mono"
                                    />
                                )}

                                {/* Değişken butonları */}
                                {!preview && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {VARIABLES.map(v => (
                                            <button
                                                key={v.key}
                                                onClick={() => insertVariable(v.key)}
                                                className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all"
                                                title={v.label}
                                            >
                                                {v.key}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                            <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all">
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!form.name.trim() || !form.message.trim() || saving}
                                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                                    form.name.trim() && form.message.trim() && !saving
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                                )}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {editTarget ? "Güncelle" : "Oluştur"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
