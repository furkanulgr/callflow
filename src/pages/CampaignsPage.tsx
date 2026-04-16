import { useState, useRef, useEffect } from "react";
import {
    Radio, Play, Pause, Trash2, Plus, Upload,
    Phone, CheckCircle2, ChevronRight,
    TrendingUp, FileText, Check, FileSpreadsheet,
    XCircle, Flame, CalendarCheck, Zap, Snowflake, Headphones,
    Bot, ChevronLeft, Loader2, AlertCircle
} from "lucide-react";
import Papa from "papaparse";
import { cn } from "@/utils/cn";
import { VoiceAgentDemoModal } from "@/components/VoiceAgentDemoModal";
import { AgentPromptEditor } from "@/components/AgentPromptEditor";
import { getPhoneNumbers, PhoneNumberItem, getAgents, AgentListItem, startBatchCalling } from "@/services/elevenlabsApi";
import { supabase } from "@/lib/supabase";

type CampaignStatus = "active" | "paused" | "completed" | "draft";

type CampaignRow = {
    id: string;
    name: string;
    status: CampaignStatus;
    total: number;
    called: number;
    answered: number;
    hot: number;
    cold: number;
    appointments: number;
    createdAt: string;
    progress: number;
    agentId: string;
    agentRole: string;
};

function mapDbCampaign(row: any): CampaignRow {
    const total = row.total_contacts || 0;
    const called = row.called || 0;
    return {
        id: row.id,
        name: row.name,
        status: row.status as CampaignStatus,
        total,
        called,
        answered: row.answered || 0,
        hot: row.hot_leads || 0,
        cold: row.cold_leads || 0,
        appointments: row.appointments || 0,
        createdAt: new Date(row.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
        progress: total > 0 ? Math.round((called / total) * 100) : 0,
        agentId: row.agent_id || "",
        agentRole: "",
    };
}

const statusConfig: Record<CampaignStatus, { label: string; cls: string; dot: string }> = {
    active: { label: "Aktif", cls: "badge-appointment", dot: "bg-emerald-500" },
    paused: { label: "Durduruldu", cls: "badge-cold", dot: "bg-amber-400" },
    completed: { label: "Tamamlandı", cls: "badge-purple", dot: "bg-gray-900" },
    draft: { label: "Taslak", cls: "badge-missed", dot: "bg-gray-400" },
};

const WIZARD_STEPS = [
    { num: 1, label: "Kampanya Tanımla" },
    { num: 2, label: "Agent & Numara" },
    { num: 3, label: "Özet & Başlat" },
];

export const CampaignsPage = () => {
    const [showModal, setShowModal] = useState(false);
    const [campaignList, setCampaignList] = useState<CampaignRow[]>([]);
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
    const [voiceDemoCampaign, setVoiceDemoCampaign] = useState<CampaignRow | null>(null);

    // Supabase'den kampanyaları çek
    useEffect(() => {
        supabase
            .from("campaigns")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setCampaignList(data.map(mapDbCampaign));
                setIsLoadingCampaigns(false);
            });
    }, []);

    // Wizard state
    const [wizardStep, setWizardStep] = useState(1);
    const [newName, setNewName] = useState("");
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [numberCount, setNumberCount] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const [agents, setAgents] = useState<AgentListItem[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState("");
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberItem[]>([]);
    const [selectedPhone, setSelectedPhone] = useState("");
    const [dailyLimit, setDailyLimit] = useState<number>(50);
    const [isLoadingStep2, setIsLoadingStep2] = useState(false);
    const [launchMode, setLaunchMode] = useState<"draft" | "active">("draft");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch agents + phone numbers when entering step 2
    useEffect(() => {
        if (wizardStep === 2 && agents.length === 0) {
            setIsLoadingStep2(true);
            Promise.all([
                getAgents().catch(() => [] as AgentListItem[]),
                getPhoneNumbers().catch(() => [] as PhoneNumberItem[]),
            ]).then(([fetchedAgents, fetchedPhones]) => {
                setAgents(fetchedAgents);
                setPhoneNumbers(fetchedPhones);
                if (fetchedAgents.length > 0) setSelectedAgentId(fetchedAgents[0].agent_id);
                if (fetchedPhones.length > 0) setSelectedPhone(fetchedPhones[0].phone_number_id);
            }).finally(() => setIsLoadingStep2(false));
        }
    }, [wizardStep]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setUploadedFile(file);
            setIsUploading(true);
            // Parse CSV to get real contact count
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    setNumberCount(results.data.length);
                    setIsUploading(false);
                },
                error: () => {
                    setIsUploading(false);
                    setNumberCount(0);
                }
            });
        }
    };

    const removeFile = () => {
        setUploadedFile(null);
        setNumberCount(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const resetWizard = () => {
        setWizardStep(1);
        setNewName("");
        removeFile();
        setSelectedAgentId("");
        setSelectedPhone("");
        setDailyLimit(50);
        setLaunchMode("draft");
        setAgents([]);
        setPhoneNumbers([]);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetWizard();
    };

    const handleNext = () => {
        if (wizardStep === 1 && !newName.trim()) return;
        setWizardStep(s => s + 1);
    };

    const handleSaveCampaign = async (mode: "draft" | "active") => {
        if (!newName.trim()) return;
        setIsSaving(true);
        setSaveError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Supabase'e kampanya kaydet
            const { data: savedCampaign, error: dbError } = await supabase
                .from("campaigns")
                .insert({
                    user_id: user?.id,
                    name: newName,
                    status: mode,
                    total_contacts: numberCount || 0,
                    agent_id: selectedAgentId || import.meta.env.VITE_LUNA_AGENT_ID || "",
                    phone_number_id: selectedPhone,
                    daily_limit: dailyLimit,
                })
                .select()
                .single();

            if (dbError) throw new Error(dbError.message);

            // 2. "Aktif" ise ElevenLabs Batch Calling başlat
            if (mode === "active" && uploadedFile && selectedAgentId && selectedPhone) {
                await startBatchCalling(
                    selectedAgentId,
                    selectedPhone,
                    uploadedFile,
                    newName
                );
                // Durumu batch_started olarak güncelle
                await supabase
                    .from("campaigns")
                    .update({ status: "active" })
                    .eq("id", savedCampaign.id);
            }

            // 3. Local listeye ekle
            const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
            const newCampaign = {
                id: savedCampaign.id,
                name: newName,
                status: mode as CampaignStatus,
                total: numberCount || 0,
                called: 0,
                answered: 0,
                hot: 0,
                cold: 0,
                appointments: 0,
                createdAt: new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
                progress: 0,
                agentId: selectedAgentId || "",
                agentRole: selectedAgent?.name || "Genel Asistan",
            };
            setCampaignList(prev => [newCampaign, ...prev]);
            handleCloseModal();

        } catch (err: any) {
            setSaveError(err.message || "Bir hata oluştu.");
        } finally {
            setIsSaving(false);
        }
    };

    const totalStats = {
        active: campaignList.filter(c => c.status === "active").length,
        called: campaignList.reduce((a, c) => a + c.called, 0),
        hot: campaignList.reduce((a, c) => a + c.hot, 0),
        appt: campaignList.reduce((a, c) => a + c.appointments, 0),
    };

    const step1Valid = newName.trim().length > 0;
    const step2Valid = selectedAgentId.length > 0;
    const selectedPhoneObj = phoneNumbers.find(p => p.phone_number_id === selectedPhone);
    const selectedAgentObj = agents.find(a => a.agent_id === selectedAgentId);

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
                            <div className="absolute top-3 right-3 flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                                <div className={cn("w-1 h-1 rounded-full", s.isAlive ? "bg-[#CCFF00] shadow-[0_0_4px_#CCFF00] animate-pulse" : "bg-gray-300")}></div>
                                <div className={cn("w-1 h-1 rounded-full", s.isAlive ? "bg-slate-700" : "bg-gray-200")}></div>
                            </div>
                            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center relative flex-shrink-0", s.bg)}>
                                {s.isAlive && <div className="absolute inset-0 rounded-xl bg-[#CCFF00] animate-ping opacity-20"></div>}
                                <s.Icon className={cn("w-5 h-5 relative z-10", s.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                                <p className="text-xs text-gray-500 font-medium truncate">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Campaign List */}
                <div className="space-y-4">
                    {isLoadingCampaigns ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-3xl p-6 card animate-pulse">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-2 h-2 rounded-full bg-gray-200" />
                                    <div className="h-4 w-48 bg-gray-200 rounded-lg" />
                                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                                </div>
                                <div className="grid grid-cols-6 gap-3 mb-4">
                                    {[1,2,3,4,5,6].map(j => <div key={j} className="h-10 bg-gray-100 rounded-xl" />)}
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full" />
                            </div>
                        ))
                    ) : campaignList.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 card flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                                <Radio className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="font-bold text-gray-700 mb-1">Henüz kampanya yok</p>
                            <p className="text-sm text-gray-400 mb-5">İlk kampanyanı oluşturarak aramaları başlat</p>
                            <button onClick={() => setShowModal(true)} className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Yeni Kampanya
                            </button>
                        </div>
                    ) : campaignList.map((c) => {
                        const sc = statusConfig[c.status];
                        return (
                            <div key={c.id} className="bg-white rounded-3xl p-6 card">
                                <div className="flex flex-col md:flex-row md:items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={cn("w-2 h-2 rounded-full", sc.dot)} />
                                            <h3 className="text-base font-bold text-gray-900 truncate">{c.name}</h3>
                                            <span className={sc.cls}>{sc.label}</span>
                                        </div>
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
                                    <div className="flex flex-col gap-2 min-w-[130px] flex-shrink-0">
                                        {c.status === "active" && (
                                            <button onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "paused" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-all active:scale-[0.98]">
                                                <Pause className="w-4 h-4" /> Durdur
                                            </button>
                                        )}
                                        {c.status === "paused" && (
                                            <button onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "active" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-[0.98]">
                                                <Play className="w-4 h-4" /> Devam
                                            </button>
                                        )}
                                        {c.status === "draft" && (
                                            <button onClick={() => setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "active" } : camp))}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl btn-primary text-xs font-bold transition-all active:scale-[0.98]">
                                                <Play className="w-4 h-4" /> Başlat
                                            </button>
                                        )}
                                        <button onClick={() => setVoiceDemoCampaign(c)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-[#CCFF00] text-xs font-bold border border-slate-800 hover:bg-slate-800 hover:shadow-[0_0_20px_rgba(204,255,0,0.15)] transition-all active:scale-[0.98] group">
                                            <Headphones className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                            Sesli Demo
                                        </button>
                                        <div className="flex gap-2 w-full mt-auto">
                                            <button onClick={() => setSelectedCampaign(c)}
                                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]">
                                                Detay
                                            </button>
                                            {c.status !== "active" && (
                                                <button onClick={async () => {
                                                    await supabase.from("campaigns").delete().eq("id", c.id);
                                                    setCampaignList(prev => prev.filter(camp => camp.id !== c.id));
                                                }}
                                                    className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all active:scale-[0.98]"
                                                    title="Sil">
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

            {/* ─── NEW CAMPAIGN WIZARD MODAL ─── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.25)] w-full max-w-2xl animate-fadeInUp overflow-hidden border border-slate-200">

                        {/* Dark Header */}
                        <div className="bg-slate-950 px-8 pt-7 pb-6">
                            <div className="flex items-center justify-between mb-7">
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Yeni Kampanya</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Toplu arama kampanyası oluşturun</p>
                                </div>
                                <button onClick={handleCloseModal} className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Step Indicator */}
                            <div className="flex items-center">
                                {WIZARD_STEPS.map((step, i) => (
                                    <div key={step.num} className="flex items-center flex-1">
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300",
                                                wizardStep > step.num
                                                    ? "bg-[#CCFF00] text-slate-900"
                                                    : wizardStep === step.num
                                                    ? "bg-[#CCFF00] text-slate-900 shadow-[0_0_20px_rgba(204,255,0,0.4)]"
                                                    : "bg-slate-800 text-slate-500"
                                            )}>
                                                {wizardStep > step.num ? <Check className="w-4 h-4" /> : step.num}
                                            </div>
                                            <span className={cn(
                                                "text-xs font-semibold whitespace-nowrap hidden sm:block",
                                                wizardStep >= step.num ? "text-white" : "text-slate-500"
                                            )}>{step.label}</span>
                                        </div>
                                        {i < WIZARD_STEPS.length - 1 && (
                                            <div className={cn(
                                                "flex-1 h-px mx-4 transition-all duration-500",
                                                wizardStep > step.num ? "bg-[#CCFF00]/50" : "bg-slate-700"
                                            )} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="px-8 py-7 min-h-[340px] flex flex-col bg-white">

                            {/* ── STEP 1: Kampanya Tanımla ── */}
                            {wizardStep === 1 && (
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Kampanya Adı <span className="text-red-400">*</span></label>
                                        <input
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                                            placeholder="Örn: Nisan Klinik Aramaları"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                                            <span>Numara Listesi</span>
                                            {uploadedFile && (
                                                <button onClick={removeFile} className="text-red-500 hover:text-red-600 text-[10px] font-bold normal-case tracking-normal">Kaldır</button>
                                            )}
                                        </label>
                                        <input type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

                                        {!uploadedFile ? (
                                            <div onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-[#CCFF00] hover:bg-[#CCFF00]/5 transition-all duration-200 group">
                                                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-[#CCFF00]/20 transition-colors">
                                                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-lime-600 transition-colors" />
                                                </div>
                                                <p className="text-sm font-bold text-slate-700">CSV veya Excel yükleyin</p>
                                                <p className="text-xs text-slate-400 mt-1.5">Her satırda bir telefon numarası olmalı</p>
                                                <span className="inline-block mt-3 text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">.csv · .xlsx · .xls · .txt</span>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-emerald-100">
                                                        <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 truncate max-w-[240px]">{uploadedFile.name}</p>
                                                        <p className="text-xs font-medium mt-1">
                                                            {isUploading ? (
                                                                <span className="flex items-center gap-1.5 text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Analiz ediliyor...</span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 text-emerald-600"><Check className="w-3.5 h-3.5" /> <strong>{numberCount}</strong> numara yüklendi</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-mono text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">{(uploadedFile.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-slate-300 inline-block"></span>
                                            Opsiyonel — kampanya başlatıldıktan sonra da eklenebilir
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── STEP 2: Agent & Numara ── */}
                            {wizardStep === 2 && (
                                <div className="space-y-6 flex-1">
                                    {isLoadingStep2 ? (
                                        <div className="flex flex-col items-center justify-center h-56 gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                                                <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500 font-medium">ElevenLabs'ten veriler çekiliyor...</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Agent Seçimi */}
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <Bot className="w-3.5 h-3.5" /> AI Agent <span className="text-red-400">*</span>
                                                </label>
                                                {agents.length > 0 ? (
                                                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                                        {agents.map(agent => (
                                                            <div key={agent.agent_id}
                                                                onClick={() => setSelectedAgentId(agent.agent_id)}
                                                                className={cn(
                                                                    "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                                    selectedAgentId === agent.agent_id
                                                                        ? "border-slate-900 bg-slate-950 shadow-lg"
                                                                        : "border-slate-100 hover:border-slate-300 bg-slate-50 hover:bg-white"
                                                                )}>
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                                                                    selectedAgentId === agent.agent_id ? "bg-[#CCFF00]" : "bg-white border border-slate-200"
                                                                )}>
                                                                    <Bot className={cn("w-5 h-5", selectedAgentId === agent.agent_id ? "text-slate-900" : "text-slate-500")} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={cn("text-sm font-bold truncate", selectedAgentId === agent.agent_id ? "text-white" : "text-slate-900")}>{agent.name}</p>
                                                                    <p className={cn("text-[10px] font-mono truncate mt-0.5", selectedAgentId === agent.agent_id ? "text-slate-400" : "text-slate-400")}>{agent.agent_id}</p>
                                                                </div>
                                                                {selectedAgentId === agent.agent_id && (
                                                                    <div className="w-6 h-6 rounded-full bg-[#CCFF00] flex items-center justify-center flex-shrink-0">
                                                                        <Check className="w-3.5 h-3.5 text-slate-900" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                                                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-amber-700 font-medium">Agent bulunamadı. ElevenLabs panelinden agent oluşturun.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Numara Seçimi */}
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                                                    <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Arama Numarası</span>
                                                    <span className="text-[9px] bg-slate-900 text-[#CCFF00] px-2.5 py-1 rounded-full uppercase tracking-widest font-bold">ElevenLabs</span>
                                                </label>
                                                {phoneNumbers.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {phoneNumbers.map(p => (
                                                            <div key={p.phone_number_id}
                                                                onClick={() => setSelectedPhone(p.phone_number_id)}
                                                                className={cn(
                                                                    "flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200",
                                                                    selectedPhone === p.phone_number_id
                                                                        ? "border-slate-900 bg-slate-950"
                                                                        : "border-slate-100 hover:border-slate-300 bg-slate-50 hover:bg-white"
                                                                )}>
                                                                <div className={cn(
                                                                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                                                                    selectedPhone === p.phone_number_id ? "bg-[#CCFF00]" : "bg-white border border-slate-200"
                                                                )}>
                                                                    <Phone className={cn("w-5 h-5", selectedPhone === p.phone_number_id ? "text-slate-900" : "text-slate-500")} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={cn("text-sm font-bold", selectedPhone === p.phone_number_id ? "text-white" : "text-slate-900")}>{p.phone_number}</p>
                                                                    {p.label && <p className={cn("text-xs mt-0.5", selectedPhone === p.phone_number_id ? "text-slate-400" : "text-slate-400")}>{p.label}</p>}
                                                                </div>
                                                                {selectedPhone === p.phone_number_id && (
                                                                    <div className="w-6 h-6 rounded-full bg-[#CCFF00] flex items-center justify-center flex-shrink-0">
                                                                        <Check className="w-3.5 h-3.5 text-slate-900" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3">
                                                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="text-xs font-bold text-red-800">Bağlı numara bulunamadı</p>
                                                            <p className="text-[10px] text-red-600 mt-0.5 leading-relaxed">ElevenLabs panelinden telefon numarası ekleyin.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── STEP 3: Özet & Başlat ── */}
                            {wizardStep === 3 && (
                                <div className="space-y-6 flex-1">
                                    {/* Dark Summary Card */}
                                    <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Kampanya Özeti</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: "Kampanya Adı", value: newName, icon: FileText },
                                                { label: "Numara Listesi", value: uploadedFile ? `${numberCount} numara` : "Yüklenmedi", icon: FileSpreadsheet },
                                                { label: "AI Agent", value: selectedAgentObj?.name || "Seçilmedi", icon: Bot },
                                                { label: "Arama Numarası", value: selectedPhoneObj?.phone_number || "Seçilmedi", icon: Phone },
                                            ].map(row => (
                                                <div key={row.label} className="flex items-start gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                        <row.icon className="w-4 h-4 text-[#CCFF00]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-slate-500 font-medium">{row.label}</p>
                                                        <p className="text-sm font-bold text-white truncate mt-0.5">{row.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Daily Limit */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Günlük Arama Limiti</label>
                                        <div className="grid grid-cols-4 gap-2 mb-3">
                                            {[20, 50, 100, 500].map(limit => (
                                                <button key={limit} onClick={() => setDailyLimit(limit)}
                                                    className={cn(
                                                        "py-3 rounded-xl text-sm font-bold transition-all border-2",
                                                        dailyLimit === limit
                                                            ? "bg-slate-950 text-[#CCFF00] border-slate-900 shadow-lg"
                                                            : "bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300"
                                                    )}>
                                                    {limit}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2 border border-slate-200">
                                            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Özel limit:</span>
                                            <input className="flex-1 bg-transparent text-sm font-bold text-slate-900 focus:outline-none" type="number" value={dailyLimit}
                                                onChange={e => setDailyLimit(parseInt(e.target.value) || 0)} />
                                            <span className="text-xs text-slate-400">arama/gün</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Wizard Footer */}
                        <div className="px-8 pb-8 space-y-3 bg-white border-t border-slate-100 pt-5">
                            {saveError && (
                                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {saveError}
                                </div>
                            )}
                            <div className="flex gap-3">
                                {wizardStep > 1 ? (
                                    <button onClick={() => setWizardStep(s => s - 1)} disabled={isSaving}
                                        className="flex items-center gap-1.5 px-6 py-3.5 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50">
                                        <ChevronLeft className="w-4 h-4" /> Geri
                                    </button>
                                ) : (
                                    <button onClick={handleCloseModal}
                                        className="px-6 py-3.5 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                                        İptal
                                    </button>
                                )}

                                {wizardStep < 3 ? (
                                    <button onClick={handleNext}
                                        disabled={wizardStep === 1 && !step1Valid}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all",
                                            (wizardStep === 1 && !step1Valid)
                                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                : "bg-slate-950 text-[#CCFF00] hover:bg-slate-800 shadow-lg shadow-slate-900/20"
                                        )}>
                                        İleri <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <div className="flex-1 flex gap-3">
                                        <button onClick={() => handleSaveCampaign("draft")} disabled={isSaving}
                                            className="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50">
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Taslak Kaydet"}
                                        </button>
                                        <button onClick={() => handleSaveCampaign("active")} disabled={isSaving}
                                            className="flex-1 py-3.5 rounded-2xl bg-slate-950 text-[#CCFF00] text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50">
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-4 h-4" /> Başlat</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign Detail Modal */}
            {selectedCampaign && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 xl:p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden relative">
                        <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-slate-50/50 flex-shrink-0">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", statusConfig[selectedCampaign.status].dot)} />
                                    <span className={cn("text-xs font-bold", statusConfig[selectedCampaign.status].cls)}>{statusConfig[selectedCampaign.status].label}</span>
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedCampaign.name}</h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">Oluşturulma: {selectedCampaign.createdAt}</p>
                            </div>
                            <button onClick={() => setSelectedCampaign(null)}
                                className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-500" /> Kampanya Özeti
                            </h3>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                            <div className="mt-8">
                                <AgentPromptEditor agentId={selectedCampaign.agentId} agentRole={selectedCampaign.agentRole} />
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
