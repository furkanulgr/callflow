import { useState, useRef, useEffect } from "react";
import {
    Radio, Play, Pause, Trash2, Plus, Upload,
    Phone, CheckCircle2, ChevronRight,
    TrendingUp, FileText, Check, FileSpreadsheet,
    XCircle, Flame, CalendarCheck, Zap, Snowflake, Headphones,
    Bot, ChevronLeft, Loader2, AlertCircle, Search
} from "lucide-react";
import Papa from "papaparse";
import { cn } from "@/utils/cn";
import { VoiceAgentDemoModal } from "@/components/VoiceAgentDemoModal";
import { getPhoneNumbers, PhoneNumberItem, getAgents, AgentListItem, startBatchCalling, getConversations, getBatchCall, cancelBatchCall, aggregateBatchStats } from "@/services/elevenlabsApi";
import { supabase } from "@/lib/supabase";
import { getLeadflowLeads, LeadflowContact } from "@/services/leadflowApi";
import { useAuth } from "@/contexts/AuthContext";

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
    batchId?: string | null;
    failed?: number;
    inProgress?: number;
    batchStatus?: string;
    lastBatchSync?: number;
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
        batchId: row.batch_id || null,
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
    const { user } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [campaignList, setCampaignList] = useState<CampaignRow[]>([]);
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
    const [voiceDemoCampaign, setVoiceDemoCampaign] = useState<CampaignRow | null>(null);
    const [detailConversations, setDetailConversations] = useState<any[]>([]);
    const [detailConvsLoading, setDetailConvsLoading] = useState(false);

    // Live batch sync: poll ElevenLabs batch endpoint, update local state + Supabase
    const syncBatch = async (batchId: string) => {
        try {
            const details = await getBatchCall(batchId);
            const agg = aggregateBatchStats(details);

            // Determine new campaign status from batch status
            const batchStatusLower = (details.status || "").toLowerCase();
            let nextStatus: CampaignStatus | null = null;
            if (batchStatusLower === "completed") nextStatus = "completed";
            else if (batchStatusLower === "cancelled") nextStatus = "paused";

            // Find the campaign for this batchId
            setCampaignList(prev => {
                const updated = prev.map(c => {
                    if (c.batchId !== batchId) return c;
                    return {
                        ...c,
                        total: agg.total || c.total,
                        called: agg.called,
                        answered: agg.answered,
                        failed: agg.failed,
                        inProgress: agg.inProgress,
                        progress: agg.progress,
                        status: nextStatus ?? c.status,
                        batchStatus: details.status,
                        lastBatchSync: Date.now(),
                    };
                });

                // Write stats back to Supabase (fire-and-forget)
                const campaign = prev.find(c => c.batchId === batchId);
                if (campaign) {
                    const dbUpdate: Record<string, any> = {
                        called: agg.called,
                        answered: agg.answered,
                    };
                    if (nextStatus) dbUpdate.status = nextStatus;

                    supabase
                        .from("campaigns")
                        .update(dbUpdate)
                        .eq("id", campaign.id)
                        .then(({ error }) => {
                            if (error) console.error("[syncBatch] Supabase update error:", error.message);
                        });
                }

                return updated;
            });
        } catch {
            /* ignore transient errors */
        }
    };

    useEffect(() => {
        // Initial + interval sync for all batchId campaigns
        const activeBatches = campaignList
            .filter(c => c.batchId && c.status === "active")
            .map(c => c.batchId as string);
        if (activeBatches.length === 0) return;
        activeBatches.forEach(syncBatch);
        const interval = setInterval(() => {
            activeBatches.forEach(syncBatch);
        }, 15000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignList.map(c => `${c.id}:${c.batchId}:${c.status}`).join("|")]);

    // Fetch batch recipients (real phone + status) when a campaign detail is opened
    useEffect(() => {
        if (!selectedCampaign) { setDetailConversations([]); return; }
        setDetailConvsLoading(true);

        if (selectedCampaign.batchId) {
            // Use batch details → recipients list (has real phone numbers + per-call status)
            getBatchCall(selectedCampaign.batchId)
                .then(details => {
                    const recipients = (details.recipients || [])
                        .slice()
                        .sort((a: any, b: any) => (b.updated_at_unix || 0) - (a.updated_at_unix || 0));
                    setDetailConversations(recipients);
                })
                .catch(() => setDetailConversations([]))
                .finally(() => setDetailConvsLoading(false));
        } else {
            // No batch → no call records
            setDetailConversations([]);
            setDetailConvsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaign?.id]);

    // Supabase'den kampanyaları çek (sadece bu kullanıcıya ait), sonra ElevenLabs'ten gerçek istatistikleri güncelle
    useEffect(() => {
        if (!user) return;
        supabase
            .from("campaigns")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .then(async ({ data, error }) => {
                if (!error && data) {
                    const mapped = data.map(mapDbCampaign);
                    setCampaignList(mapped);
                    setIsLoadingCampaigns(false);

                    // Her kampanya için ElevenLabs'ten gerçek istatistik çek
                    const agentIds = [...new Set(mapped.map(c => c.agentId).filter(Boolean))];
                    const convMap: Record<string, any[]> = {};
                    await Promise.allSettled(
                        agentIds.map(async (agentId) => {
                            try {
                                const convs = await getConversations(agentId);
                                convMap[agentId] = convs;
                            } catch {}
                        })
                    );

                    setCampaignList(prev => prev.map(c => {
                        if (!c.agentId || !convMap[c.agentId]) return c;
                        const campaignCreatedAt = new Date(data.find(d => d.id === c.id)?.created_at || 0).getTime() / 1000;
                        const convs = convMap[c.agentId].filter(
                            conv => (conv.start_time_unix_secs || 0) >= campaignCreatedAt - 60
                        );
                        const called = convs.length;
                        const answered = convs.filter(conv =>
                            (conv.call_duration_secs ?? 0) > 0 && conv.status !== "failed"
                        ).length;
                        const progress = c.total > 0 ? Math.round((called / c.total) * 100) : 0;
                        return { ...c, called, answered, progress };
                    }));
                } else {
                    setIsLoadingCampaigns(false);
                }
            });
    }, [user]);

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

    // LeadFlow import state
    const [contactSource, setContactSource]           = useState<"csv" | "leadflow">("csv");
    const [lfLeads, setLfLeads]                       = useState<LeadflowContact[]>([]);
    const [lfLeadsLoading, setLfLeadsLoading]         = useState(false);
    const [lfLeadsTotal, setLfLeadsTotal]             = useState(0);
    const [selectedLfIds, setSelectedLfIds]           = useState<Set<string>>(new Set());
    const [lfSearch, setLfSearch]                     = useState("");

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
        setContactSource("csv");
        setSelectedLfIds(new Set());
        setLfSearch("");
    };

    // LeadFlow leads: modal açılıp "LeadFlow'dan İçe Aktar" sekmesine geçince yükle
    useEffect(() => {
        if (contactSource !== "leadflow" || !showModal) return;
        setLfLeadsLoading(true);
        getLeadflowLeads()
            .then(({ leads, total }) => {
                setLfLeads(leads);
                setLfLeadsTotal(total);
            })
            .catch(() => { setLfLeads([]); setLfLeadsTotal(0); })
            .finally(() => setLfLeadsLoading(false));
    }, [contactSource, showModal]);

    const toggleLfLead = (id: string) => setSelectedLfIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const toggleAllLfLeads = (visibleIds: string[]) => {
        const allSelected = visibleIds.every(id => selectedLfIds.has(id));
        setSelectedLfIds(prev => {
            const next = new Set(prev);
            if (allSelected) visibleIds.forEach(id => next.delete(id));
            else visibleIds.forEach(id => next.add(id));
            return next;
        });
    };

    const filteredLfLeads = lfLeads.filter(l => {
        if (!lfSearch) return true;
        const q = lfSearch.toLowerCase();
        return (l.name ?? "").toLowerCase().includes(q) || (l.phone ?? "").includes(q);
    });

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

            // LeadFlow seçiliyse seçili lead'lerin phone numaralarını al
            const lfSelectedLeads = contactSource === "leadflow"
                ? lfLeads.filter(l => selectedLfIds.has(l.id))
                : [];
            const totalCount = contactSource === "leadflow"
                ? lfSelectedLeads.length
                : numberCount || 0;

            // 1. Supabase'e kampanya kaydet
            const { data: savedCampaign, error: dbError } = await supabase
                .from("campaigns")
                .insert({
                    user_id: user?.id,
                    name: newName,
                    status: mode,
                    total_contacts: totalCount,
                    agent_id: selectedAgentId || import.meta.env.VITE_LUNA_AGENT_ID || "",
                    phone_number_id: selectedPhone,
                    daily_limit: dailyLimit,
                })
                .select()
                .single();

            if (dbError) throw new Error(dbError.message);

            // 2. "Aktif" ise ElevenLabs Batch Calling başlat
            let batchId: string | null = null;
            if (mode === "active" && selectedAgentId && selectedPhone) {
                if (contactSource === "leadflow" && lfSelectedLeads.length > 0) {
                    // LeadFlow leadlerinden CSV oluştur ve batch'e gönder
                    const csvContent = "phone_number\n" + lfSelectedLeads.map(l => l.phone).join("\n");
                    const csvBlob = new Blob([csvContent], { type: "text/csv" });
                    const csvFile = new File([csvBlob], "leadflow_contacts.csv", { type: "text/csv" });
                    const batchResult = await startBatchCalling(selectedAgentId, selectedPhone, csvFile, newName);
                    batchId = batchResult.batch_id;
                } else if (uploadedFile) {
                    const batchResult = await startBatchCalling(selectedAgentId, selectedPhone, uploadedFile, newName);
                    batchId = batchResult.batch_id;
                }

                if (batchId) {
                    await supabase
                        .from("campaigns")
                        .update({ status: "active", batch_id: batchId })
                        .eq("id", savedCampaign.id)
                        .then(async ({ error: upErr }) => {
                            if (upErr) {
                                await supabase.from("campaigns").update({ status: "active" }).eq("id", savedCampaign.id);
                            }
                        });
                }
            }

            // 3. Local listeye ekle
            const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
            const newCampaign = {
                id: savedCampaign.id,
                name: newName,
                status: mode as CampaignStatus,
                total: totalCount,
                called: 0,
                answered: 0,
                hot: 0,
                cold: 0,
                appointments: 0,
                createdAt: new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
                progress: 0,
                agentId: selectedAgentId || "",
                agentRole: selectedAgent?.name || "Genel Asistan",
                batchId,
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

    const step1Valid = newName.trim().length > 0 &&
        (contactSource === "csv" || selectedLfIds.size > 0);
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
                                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                                            <div className={cn("w-2 h-2 rounded-full", sc.dot)} />
                                            <h3 className="text-base font-bold text-gray-900 truncate">{c.name}</h3>
                                            <span className={sc.cls}>{sc.label}</span>
                                            {c.batchId && c.status === "active" && (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#CCFF00]/20 border border-[#CCFF00]/30 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_#10b981]" />
                                                    Canlı
                                                </span>
                                            )}
                                            {c.batchId && (
                                                <span className="text-[9px] font-mono text-slate-400" title={`Batch ID: ${c.batchId}`}>
                                                    #{c.batchId.slice(0, 8)}
                                                </span>
                                            )}
                                            {typeof c.failed === "number" && c.failed > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-100 text-[10px] font-bold text-red-600">
                                                    <XCircle className="w-3 h-3" /> {c.failed} hata
                                                </span>
                                            )}
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
                                        {/* Progress */}
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-700">İlerleme</span>
                                                    {c.status === "active" && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Canlı
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-lg font-black text-slate-900">%{c.progress}</span>
                                                    <span className="text-xs text-slate-400 font-medium">{c.called}/{c.total}</span>
                                                </div>
                                            </div>

                                            {/* Segmented bar */}
                                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                                                {/* Yanıtlayan - yeşil */}
                                                <div className="h-full bg-emerald-400 transition-all duration-700 rounded-l-full"
                                                    style={{ width: `${c.total > 0 ? (c.answered / c.total) * 100 : 0}%` }} />
                                                {/* Cevapsız - kırmızı */}
                                                <div className="h-full bg-red-300 transition-all duration-700"
                                                    style={{ width: `${c.total > 0 ? ((c.called - c.answered) / c.total) * 100 : 0}%` }} />
                                                {/* Kalan - lime (aranmamış) */}
                                                <div className="h-full transition-all duration-700"
                                                    style={{ width: `${c.total > 0 ? ((c.total - c.called) / c.total) * 100 : 100}%`, background: "transparent" }} />
                                            </div>

                                            {/* Legend */}
                                            <div className="flex items-center gap-4 mt-2.5">
                                                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Yanıtlayan {c.answered}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                                    <span className="w-2 h-2 rounded-full bg-red-300" /> Cevapsız {c.called - c.answered}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 ml-auto">
                                                    {c.total - c.called} kişi kaldı
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 min-w-[130px] flex-shrink-0">
                                        {c.status === "active" && (
                                            <button onClick={async () => {
                                                if (c.batchId) {
                                                    if (!confirm("Canlı kampanya iptal edilecek. Emin misin?")) return;
                                                    try { await cancelBatchCall(c.batchId); } catch {}
                                                }
                                                setCampaignList(prev => prev.map(camp => camp.id === c.id ? { ...camp, status: "paused" } : camp));
                                                await supabase.from("campaigns").update({ status: "paused" }).eq("id", c.id);
                                            }}
                                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-orange-50 text-orange-600 text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-all active:scale-[0.98]">
                                                <Pause className="w-4 h-4" /> {c.batchId ? "İptal Et" : "Durdur"}
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
                                        {/* Kaynak seçici: CSV vs LeadFlow */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Numara Kaynağı</label>
                                            <div className="flex items-center bg-slate-100 rounded-xl p-1 ml-auto">
                                                <button
                                                    onClick={() => setContactSource("csv")}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                        contactSource === "csv" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <FileSpreadsheet className="w-3.5 h-3.5" /> CSV Yükle
                                                </button>
                                                <button
                                                    onClick={() => setContactSource("leadflow")}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                        contactSource === "leadflow" ? "bg-slate-900 text-[#CCFF00] shadow-sm" : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    <Zap className="w-3.5 h-3.5" /> LeadFlow
                                                    {lfLeadsTotal > 0 && (
                                                        <span className="bg-[#CCFF00]/20 text-[#CCFF00] px-1.5 py-0.5 rounded-md text-[10px] font-black">
                                                            {lfLeadsTotal}
                                                        </span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* CSV yükleme */}
                                        {contactSource === "csv" && (
                                            <>
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
                                                        <button onClick={removeFile} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                                                    <span className="w-1 h-1 rounded-full bg-slate-300 inline-block" />
                                                    Opsiyonel — kampanya başlatıldıktan sonra da eklenebilir
                                                </p>
                                            </>
                                        )}

                                        {/* LeadFlow lead listesi */}
                                        {contactSource === "leadflow" && (
                                            <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                                                {/* Arama + seçim sayısı */}
                                                <div className="flex items-center gap-3 p-3 border-b border-slate-100 bg-slate-50">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                                        <input
                                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                                                            placeholder="İsim veya numara ara..."
                                                            value={lfSearch}
                                                            onChange={e => setLfSearch(e.target.value)}
                                                        />
                                                    </div>
                                                    {selectedLfIds.size > 0 && (
                                                        <span className="text-xs font-bold text-[#CCFF00] bg-slate-900 px-2.5 py-1 rounded-lg flex-shrink-0">
                                                            {selectedLfIds.size} seçildi
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Liste */}
                                                <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                                                    {lfLeadsLoading ? (
                                                        <div className="flex items-center justify-center py-10">
                                                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                                        </div>
                                                    ) : filteredLfLeads.length === 0 ? (
                                                        <div className="text-center py-10 space-y-2">
                                                            <Zap className="w-8 h-8 text-slate-200 mx-auto" />
                                                            <p className="text-sm font-medium text-slate-400">
                                                                {lfLeadsTotal === 0
                                                                    ? "LeadFlow'dan henüz lead gelmemiş"
                                                                    : "Arama sonucu bulunamadı"}
                                                            </p>
                                                            {lfLeadsTotal === 0 && (
                                                                <p className="text-xs text-slate-400">Ayarlar → Entegrasyonlar'dan API key oluşturup LeadFlow'a gir</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Tümünü seç satırı */}
                                                            <div
                                                                onClick={() => toggleAllLfLeads(filteredLfLeads.map(l => l.id))}
                                                                className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                                            >
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all",
                                                                    filteredLfLeads.every(l => selectedLfIds.has(l.id))
                                                                        ? "bg-slate-900 border-slate-900"
                                                                        : "border-slate-300 bg-white"
                                                                )}>
                                                                    {filteredLfLeads.every(l => selectedLfIds.has(l.id)) && (
                                                                        <Check className="w-2.5 h-2.5 text-[#CCFF00]" />
                                                                    )}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-600">Tümünü Seç ({filteredLfLeads.length})</span>
                                                            </div>
                                                            {filteredLfLeads.map(lead => (
                                                                <div
                                                                    key={lead.id}
                                                                    onClick={() => toggleLfLead(lead.id)}
                                                                    className={cn(
                                                                        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                                                                        selectedLfIds.has(lead.id) ? "bg-[#CCFF00]/5" : "hover:bg-slate-50"
                                                                    )}
                                                                >
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all",
                                                                        selectedLfIds.has(lead.id) ? "bg-slate-900 border-slate-900" : "border-slate-300 bg-white"
                                                                    )}>
                                                                        {selectedLfIds.has(lead.id) && <Check className="w-2.5 h-2.5 text-[#CCFF00]" />}
                                                                    </div>
                                                                    <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-[#CCFF00] text-xs font-bold flex-shrink-0">
                                                                        {(lead.name || lead.phone)[0]?.toUpperCase() || "?"}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-bold text-slate-800 truncate">{lead.name || lead.phone}</p>
                                                                        <p className="text-[10px] text-slate-400 font-mono">{lead.phone}</p>
                                                                    </div>
                                                                    {lead.tags && lead.tags.length > 0 && (
                                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                                                            {lead.tags[0]}
                                                                        </span>
                                                                    )}
                                                                    <p className="text-[10px] text-slate-400 flex-shrink-0">
                                                                        {new Date(lead.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
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
                                            <p className="text-sm text-slate-500 font-medium">Veriler çekiliyor...</p>
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
                                                        <p className="text-xs text-amber-700 font-medium">Agent bulunamadı. Önce AI Asistanlar sayfasından agent oluşturun.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Numara Seçimi */}
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                                                    <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Arama Numarası</span>
                                                    <span className="text-[9px] bg-slate-900 text-[#CCFF00] px-2.5 py-1 rounded-full uppercase tracking-widest font-bold">SIP</span>
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
                                                            <p className="text-[10px] text-red-600 mt-0.5 leading-relaxed">Ayarlar'dan telefon numarası ekleyin.</p>
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
                                                { label: "Numara Listesi", value: contactSource === "leadflow" ? `${selectedLfIds.size} LeadFlow lead` : uploadedFile ? `${numberCount} numara` : "Yüklenmedi", icon: FileSpreadsheet },
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

            {/* Campaign Detail Modal — Light & UX-focused */}
            {selectedCampaign && (() => {
                const progress = selectedCampaign.progress || 0;
                const remaining = selectedCampaign.total - selectedCampaign.called;
                const missed = selectedCampaign.called - selectedCampaign.answered;
                const successRate = selectedCampaign.called > 0
                    ? Math.round((selectedCampaign.answered / selectedCampaign.called) * 100)
                    : 0;
                // Circular progress geometry
                const radius = 56;
                const circumference = 2 * Math.PI * radius;
                const dashOffset = circumference - (progress / 100) * circumference;

                return (
                <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md z-[100] flex items-center justify-center p-4 lg:p-6 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_-15px_rgba(15,23,42,0.25)] border border-slate-200/60">

                        {/* Light header */}
                        <div className="relative px-8 py-6 border-b border-slate-100 bg-white flex-shrink-0">
                            <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4 min-w-0">
                                    {/* Status indicator */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                                        selectedCampaign.status === "active" && "bg-emerald-50",
                                        selectedCampaign.status === "paused" && "bg-amber-50",
                                        selectedCampaign.status === "completed" && "bg-purple-50",
                                        selectedCampaign.status === "draft" && "bg-slate-100",
                                    )}>
                                        <Radio className={cn(
                                            "w-5 h-5",
                                            selectedCampaign.status === "active" && "text-emerald-600",
                                            selectedCampaign.status === "paused" && "text-amber-600",
                                            selectedCampaign.status === "completed" && "text-purple-600",
                                            selectedCampaign.status === "draft" && "text-slate-500",
                                        )} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                selectedCampaign.status === "active" && "bg-emerald-100 text-emerald-700",
                                                selectedCampaign.status === "paused" && "bg-amber-100 text-amber-700",
                                                selectedCampaign.status === "completed" && "bg-purple-100 text-purple-700",
                                                selectedCampaign.status === "draft" && "bg-slate-100 text-slate-600",
                                            )}>
                                                <span className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    selectedCampaign.status === "active" && "bg-emerald-500 animate-pulse",
                                                    selectedCampaign.status === "paused" && "bg-amber-500",
                                                    selectedCampaign.status === "completed" && "bg-purple-500",
                                                    selectedCampaign.status === "draft" && "bg-slate-400",
                                                )} />
                                                {statusConfig[selectedCampaign.status].label}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-medium">{selectedCampaign.createdAt}</span>
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight truncate" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                                            {selectedCampaign.name}
                                        </h2>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCampaign(null)}
                                    className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Body — single page, all visible, no scroll for main */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">

                            {/* PROGRESS BLOCK */}
                            <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
                                <div className="px-5 py-4">
                                    {/* Başlık + yüzde */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-slate-900 tabular-nums leading-none">%{progress}</span>
                                            <span className="text-xs font-medium text-slate-400">tamamlandı</span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-500">
                                            {selectedCampaign.called} / {selectedCampaign.total} aranan
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-emerald-400 transition-all duration-1000"
                                            style={{ width: `${selectedCampaign.total > 0 ? (selectedCampaign.answered / selectedCampaign.total) * 100 : 0}%` }} />
                                        <div className="h-full bg-red-300 transition-all duration-1000"
                                            style={{ width: `${selectedCampaign.total > 0 ? (missed / selectedCampaign.total) * 100 : 0}%` }} />
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 mt-2.5">
                                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Yanıtlayan <b className="text-emerald-600">{selectedCampaign.answered}</b>
                                        </span>
                                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                                            <span className="w-2 h-2 rounded-full bg-red-300" /> Cevapsız <b className="text-red-500">{missed}</b>
                                        </span>
                                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 ml-auto">
                                            <span className="w-2 h-2 rounded-full bg-slate-200" /> Kalan <b className="text-slate-700">{remaining}</b>
                                        </span>
                                    </div>
                                </div>

                                {/* Alt stat strip */}
                                <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                                    {[
                                        { label: "Toplam", value: selectedCampaign.total, color: "text-slate-800" },
                                        { label: "Aranan", value: selectedCampaign.called, color: "text-blue-600" },
                                        { label: "Başarı", value: `%${successRate}`, color: "text-emerald-600" },
                                        { label: "Randevu", value: selectedCampaign.appointments, color: "text-purple-600" },
                                    ].map((s, i) => (
                                        <div key={i} className="px-4 py-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                                            <p className={cn("text-base font-black tabular-nums mt-0.5", s.color)}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Lead kalitesi — minimal inline */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-50 border border-orange-100">
                                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                                    <span className="text-[11px] font-bold text-orange-700">Sıcak Lead</span>
                                    <span className="text-sm font-black text-orange-600 tabular-nums">{selectedCampaign.hot}</span>
                                </div>
                                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-100">
                                    <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                                    <span className="text-[11px] font-bold text-sky-700">Soğuk Lead</span>
                                    <span className="text-sm font-black text-sky-600 tabular-nums">{selectedCampaign.cold}</span>
                                </div>
                            </div>

                            {/* CALL LIST */}
                            <div className="bg-white rounded-3xl border border-slate-200/70 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                                            <Phone className="w-5 h-5 text-[#CCFF00]" />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-slate-900">Aramalar</h4>
                                            <p className="text-xs text-slate-400 font-medium">Bu kampanyadaki numaralar</p>
                                        </div>
                                    </div>
                                    {detailConversations.length > 0 && (
                                        <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
                                            {detailConversations.length} kayıt
                                        </span>
                                    )}
                                </div>

                                <div className="max-h-[320px] overflow-y-auto">
                                    {detailConvsLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                                        </div>
                                    ) : detailConversations.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                                                <Phone className="w-7 h-7 text-slate-300" />
                                            </div>
                                            <p className="text-base font-bold text-slate-500">Henüz arama yok</p>
                                            <p className="text-sm text-slate-400 max-w-xs text-center">
                                                {selectedCampaign?.batchId ? "Aramalar başladığında burada anlık görünecek" : "Kampanya 'Başlat' ile aktif edilince aramalar listelenir"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-50">
                                            {detailConversations.map((recipient: any, i: number) => {
                                                const status: string = recipient.status || "pending";
                                                const isCompleted = status === "completed";
                                                const isFailed = status === "failed" || status === "cancelled";
                                                const isActive = status === "in_progress";
                                                const updatedAt = recipient.updated_at_unix
                                                    ? new Date(recipient.updated_at_unix * 1000).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                                                    : "—";
                                                const statusLabel = isCompleted ? "Tamamlandı" : isFailed ? "Başarısız" : isActive ? "Aranıyor" : "Bekliyor";
                                                const statusCls = isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : isFailed ? "bg-red-50 text-red-600 border-red-200"
                                                    : isActive ? "bg-blue-50 text-blue-600 border-blue-200"
                                                    : "bg-slate-50 text-slate-500 border-slate-200";
                                                const iconBg = isCompleted ? "bg-emerald-100" : isFailed ? "bg-red-100" : isActive ? "bg-blue-100" : "bg-slate-100";
                                                const iconColor = isCompleted ? "text-emerald-600" : isFailed ? "text-red-500" : isActive ? "text-blue-600" : "text-slate-400";

                                                return (
                                                    <div key={recipient.id || recipient.phone_number || i}
                                                        className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                                                        <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0", iconBg, isActive && "animate-pulse")}>
                                                            <Phone className={cn("w-5 h-5", iconColor)} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-base font-bold text-slate-900 font-mono truncate tracking-tight">
                                                                {recipient.phone_number || "—"}
                                                            </p>
                                                            <p className="text-xs text-slate-400 font-medium mt-0.5">{updatedAt}</p>
                                                        </div>
                                                        <span className={cn("text-xs px-3 py-1.5 rounded-full font-bold border flex-shrink-0", statusCls)}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

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
