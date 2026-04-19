import { useState, useEffect, useMemo } from "react";
import { getAgents, getConversations, deleteAgent, duplicateAgent, AgentListItem, LUNA_API_KEY, LUNA_AGENT_ID } from "@/services/elevenlabsApi";
import { BrainCircuit, Loader2, Bot, Calendar, Headphones, Settings2, X, Activity, CheckCircle2, Phone, Clock, TrendingUp, Trash2, AlertTriangle, Copy } from "lucide-react";
import { cn, formatDuration } from "@/utils/cn";
import { AgentPromptEditor } from "@/components/AgentPromptEditor";
import { VoiceAgentDemoModal } from "@/components/VoiceAgentDemoModal";
import { CreateAgentModal } from "@/components/CreateAgentModal";

interface AgentStats {
    total: number;
    answered: number;
    missed: number;
    answerRate: number;
    avgDuration: number;
    successCount: number;
}

const emptyStats: AgentStats = { total: 0, answered: 0, missed: 0, answerRate: 0, avgDuration: 0, successCount: 0 };

export const AgentsPage = () => {
    const [agents, setAgents] = useState<AgentListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);

    // States for Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [voiceDemoAgent, setVoiceDemoAgent] = useState<AgentListItem | null>(null);
    const [editingAgent, setEditingAgent] = useState<AgentListItem | null>(null);
    const [deletingAgent, setDeletingAgent] = useState<AgentListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Duplicate flow
    const [duplicatingAgent, setDuplicatingAgent] = useState<AgentListItem | null>(null);
    const [duplicateName, setDuplicateName] = useState("");
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [duplicateError, setDuplicateError] = useState<string | null>(null);

    const openDuplicate = (agent: AgentListItem) => {
        setDuplicatingAgent(agent);
        setDuplicateName(`${agent.name || "Asistan"} (Kopya)`);
        setDuplicateError(null);
    };

    const handleConfirmDuplicate = async () => {
        if (!duplicatingAgent || !duplicateName.trim()) return;
        setIsDuplicating(true);
        setDuplicateError(null);
        try {
            const apiKey = duplicatingAgent.agent_id === LUNA_AGENT_ID ? LUNA_API_KEY : undefined;
            const newId = await duplicateAgent(duplicatingAgent.agent_id, duplicateName.trim(), apiKey);
            // Optimistically prepend; real list will re-fetch
            setAgents(prev => [
                { agent_id: newId, name: duplicateName.trim(), created_at_unix_secs: Math.floor(Date.now() / 1000) } as AgentListItem,
                ...prev,
            ]);
            setDuplicatingAgent(null);
            setDuplicateName("");
            // Re-fetch in background to sync with server metadata
            fetchAgents();
        } catch (err: any) {
            setDuplicateError(err.message || "Kopyalama başarısız.");
        } finally {
            setIsDuplicating(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deletingAgent) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await deleteAgent(deletingAgent.agent_id);
            setAgents(prev => prev.filter(a => a.agent_id !== deletingAgent.agent_id));
            setDeletingAgent(null);
        } catch (err: any) {
            setDeleteError(err.message || "Asistan silinemedi.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Stats map: agent_id → AgentStats
    const statsByAgent = useMemo(() => {
        const map = new Map<string, AgentStats>();
        conversations.forEach(conv => {
            const aid = conv.agent_id || conv.agentId;
            if (!aid) return;
            const duration = conv.call_duration_secs ?? conv.duration_secs ?? 0;
            const answered = duration > 0 && conv.status !== "failed" && conv.status !== "error";
            const succeeded = conv.call_successful === "success";
            const cur = map.get(aid) || { ...emptyStats };
            cur.total += 1;
            if (answered) cur.answered += 1;
            else cur.missed += 1;
            if (succeeded) cur.successCount += 1;
            // accumulate total duration temporarily in avgDuration; finalize below
            cur.avgDuration += duration;
            map.set(aid, cur);
        });
        // Finalize derived values
        map.forEach((s, key) => {
            const totalDur = s.avgDuration;
            s.avgDuration = s.answered > 0 ? Math.round(totalDur / s.answered) : 0;
            s.answerRate = s.total > 0 ? Math.round((s.answered / s.total) * 100) : 0;
            map.set(key, s);
        });
        return map;
    }, [conversations]);

    const getStats = (agentId: string): AgentStats => statsByAgent.get(agentId) || emptyStats;

    const fetchAgents = async () => {
        setIsLoading(true);
        try {
            const data = await getAgents();
            setAgents(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Ajanlar yüklenirken hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const initialFetch = async () => {
            try {
                const data = await getAgents();
                if (isMounted) setAgents(data);
            } catch (err: any) {
                if (isMounted) setError(err.message || "Ajanlar yüklenirken hata oluştu.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        initialFetch();

        // Background: fetch all conversations for per-agent stats (non-blocking)
        getConversations()
            .then(data => { if (isMounted) setConversations(data); })
            .catch(() => { /* stats optional */ });

        return () => { isMounted = false; };
    }, []);

    const formatDate = (unixSecs: number) => {
        if (!unixSecs) return "Bilinmiyor";
        const date = new Date(unixSecs * 1000);
        return date.toLocaleDateString("tr-TR", { day: 'numeric', month: 'long', year: 'numeric' });
    };

    return (
        <div className="w-full h-full min-h-screen relative overflow-hidden flex flex-col p-4 md:p-8 pb-32 bg-[#F8FAFC]">

            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/10 blur-[140px] pointer-events-none" />
            <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-[#CCFF00]/10 blur-[140px] pointer-events-none" />

            <div className="relative z-10 max-w-[1600px] w-full mx-auto">
                {/* Strategic Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 animate-in slide-in-from-bottom-4 duration-700 fade-in">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 text-[#CCFF00] mb-2">
                            <div className="p-2 rounded-xl bg-slate-950 shadow-[0_0_20px_rgba(204,255,0,0.2)] flex items-center justify-center ring-1 ring-white/10">
                                <BrainCircuit className="w-5 h-5 drop-shadow-[0_0_8px_rgba(204,255,0,0.8)]" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">KOMUTA MERKEZİ</span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                            Yapay Zeka <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-[#9acc00]">Asistanlar</span>
                        </h1>
                        <p className="text-slate-500 text-base font-medium max-w-2xl mt-2 leading-relaxed">
                            Sisteme entegre tüm yapay zeka ajanlarınıza tek bir noktadan hükmedin. Karakter kurallarını optimize edin, performansı şekillendirin ve anında canlı bağlantı ile test edin.
                        </p>
                    </div>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="group relative flex items-center gap-3 px-6 py-4 bg-slate-900 text-[#CCFF00] rounded-2xl font-black text-sm tracking-wide overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.15)] hover:shadow-[0_12px_30px_rgba(204,255,0,0.25)] hover:-translate-y-1 transition-all duration-300 active:scale-95"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#CCFF00]/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                        <span className="relative z-10 flex items-center justify-center w-6 h-6 bg-[#CCFF00] text-slate-900 rounded-full">
                            <span className="text-lg leading-none mb-0.5">+</span>
                        </span>
                        <span>Yeni Asistan Yarat</span>
                    </button>
                </div>

                {/* Main Content Area */}
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20">
                        <div className="relative w-20 h-20 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-[#CCFF00]/20 rounded-full animate-pulse" />
                            <Loader2 className="w-10 h-10 text-[#CCFF00] animate-spin drop-shadow-md" />
                        </div>
                        <p className="text-slate-500 font-bold mt-6 tracking-[0.1em] uppercase text-sm">Sistem Yapılandırılıyor...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50/50 backdrop-blur-md border border-red-100 rounded-[2rem] p-10 flex flex-col items-center justify-center text-center shadow-lg">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50">
                            <X className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-red-900 font-black text-2xl mb-2">Bağlantı Hatası</h3>
                        <p className="text-red-700/80 font-medium mb-8 max-w-md">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-[0_8px_20px_rgba(220,38,38,0.25)] active:scale-95">
                            Bağlantıyı Tekrar Dene
                        </button>
                    </div>
                ) : agents.length === 0 ? (
                    <div className="bg-white/60 backdrop-blur-xl border border-slate-200 border-dashed rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded-[2rem] flex items-center justify-center shadow-inner mb-6 border border-white">
                            <Bot className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-slate-900 font-black text-2xl mb-3">Sistemde Asistan Bulunamadı</h3>
                        <p className="text-slate-500 font-medium max-w-md mb-8 leading-relaxed">
                            Hesabınızda şu an yapılandırılmış aktif bir yapay zeka asistanı bulunmuyor. Sisteme yeni bir asistan entegre edildikten sonra burada listelenecektir.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-8 duration-700 fade-in delay-100 fill-mode-backwards">
                        
                        {/* LUNA ANA ASİSTAN KARTI (Dark Mode) */}
                        <div className="group bg-slate-950 rounded-[2rem] p-6 border border-[#CCFF00]/20 shadow-[0_8px_30px_rgba(204,255,0,0.05)] hover:shadow-[0_20px_40px_rgba(204,255,0,0.15)] hover:border-[#CCFF00]/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col items-start relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#CCFF00]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            <div className="absolute -right-12 -top-12 w-48 h-48 bg-gradient-to-br from-[#CCFF00]/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-3xl scale-90 group-hover:scale-100" />

                            {/* Status and Tech Info */}
                            <div className="w-full flex justify-between items-start mb-6">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-[1.25rem] bg-slate-900 shadow-2xl flex items-center justify-center relative z-10 text-[#CCFF00] overflow-hidden group-hover:scale-105 transition-transform duration-500 ring-1 ring-[#CCFF00]/30">
                                        <Bot className="w-8 h-8 drop-shadow-[0_0_12px_rgba(204,255,0,0.8)]" />
                                    </div>
                                    <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-[#CCFF00] rounded-full border-[3px] border-slate-950 z-20 shadow-[0_0_10px_#CCFF00]" />
                                </div>

                                <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-[9px] font-black tracking-[0.2em] uppercase bg-[#CCFF00]/10 text-[#CCFF00] px-3 py-1 rounded-full border border-[#CCFF00]/20 shadow-sm">
                                        ANA ASİSTAN
                                    </span>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20 shadow-sm backdrop-blur-sm">
                                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-[10px] font-bold text-emerald-400">Sistem Aktif</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 w-full mb-8">
                                <h3 className="text-[22px] font-black text-white mb-2 tracking-tight line-clamp-1 group-hover:text-[#CCFF00] transition-colors duration-300">ZEYNEP (KONTROL)</h3>

                                <div className="flex items-center justify-between w-full p-3 bg-slate-900/80 rounded-xl border border-slate-800 mb-4 group-hover:border-slate-700 transition-colors shadow-inner backdrop-blur-sm">
                                    <p className="text-[11px] text-slate-400 font-medium font-mono truncate text-ellipsis" title="agent_6701knh148pgfyvvsbfjeg27ps3n">
                                        Sistem ID: <span className="text-slate-200 font-bold ml-1">agent_6701kn...</span>
                                    </p>
                                </div>

                                {(() => {
                                    const s = getStats(LUNA_AGENT_ID);
                                    return (
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold bg-slate-900 border border-slate-800 shadow-sm p-2.5 rounded-xl">
                                                <Phone className="w-4 h-4 text-[#CCFF00]" />
                                                <span className="truncate">{s.total} Arama</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold bg-slate-900 border border-slate-800 shadow-sm p-2.5 rounded-xl">
                                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                                <span className="truncate">%{s.answerRate} Yanıt</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold bg-slate-900 border border-slate-800 shadow-sm p-2.5 rounded-xl">
                                                <Clock className="w-4 h-4 text-sky-400" />
                                                <span className="truncate">{formatDuration(s.avgDuration)} ort.</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold bg-slate-900 border border-slate-800 shadow-sm p-2.5 rounded-xl">
                                                <CheckCircle2 className="w-4 h-4 text-[#CCFF00]" />
                                                <span className="truncate">{s.successCount} Başarı</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex flex-col gap-3 w-full mt-auto relative z-10">
                                <button
                                    onClick={() => setVoiceDemoAgent({ agent_id: LUNA_AGENT_ID, name: 'ZEYNEP' } as any)}
                                    className="w-full relative group/btn flex justify-center items-center gap-2.5 py-4 bg-[#CCFF00] text-slate-950 rounded-2xl font-black text-sm tracking-wide overflow-hidden shadow-[0_8px_20px_rgba(204,255,0,0.15)] hover:shadow-[0_8px_30px_rgba(204,255,0,0.3)] hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]"
                                >
                                    <Headphones className="w-4.5 h-4.5" /> ZEYNEP'e Bağlan
                                </button>

                                <button
                                    onClick={() => setEditingAgent({ agent_id: LUNA_AGENT_ID, name: 'ZEYNEP' } as any)}
                                    className="w-full flex justify-center items-center gap-2.5 py-3.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl font-bold text-sm tracking-wide hover:border-slate-700 hover:text-white hover:bg-slate-800 hover:shadow-md transition-all active:scale-[0.98]"
                                >
                                    <Settings2 className="w-4 h-4" /> Nöral Bağları Yönet
                                </button>
                            </div>
                        </div>
                        
                        {/* Diğer Ajanlar (Beyaz Kartlar) */}
                        {agents.map((agent) => (
                            <div key={agent.agent_id} className="group bg-white/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:border-[#CCFF00]/40 hover:-translate-y-1.5 transition-all duration-300 flex flex-col items-start relative overflow-hidden">
                                <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openDuplicate(agent); }}
                                        title="Kopyala"
                                        className="p-2 rounded-xl bg-white/80 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    {agent.agent_id !== LUNA_AGENT_ID && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeletingAgent(agent); }}
                                            title="Asistanı Sil"
                                            className="p-2 rounded-xl bg-white/80 border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Card Glass Shimmer Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                <div className="absolute -right-12 -top-12 w-48 h-48 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-3xl scale-90 group-hover:scale-100" />

                                {/* Status and Tech Info */}
                                <div className="w-full flex justify-between items-start mb-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl flex items-center justify-center relative z-10 text-[#CCFF00] overflow-hidden group-hover:scale-105 transition-transform duration-500 ring-1 ring-white/10">
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
                                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                                            <Bot className="w-8 h-8 drop-shadow-[0_0_12px_rgba(204,255,0,0.8)]" />
                                        </div>
                                        {/* Status Pulsating Dot removed */}
                                        <div className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-emerald-500 rounded-full border-[3px] border-white z-20 shadow-md" />
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="bg-slate-100/80 text-slate-500 text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-md border border-slate-200/50 shadow-sm backdrop-blur-sm">
                                            LUERA CORE V2
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/80 rounded-md border border-emerald-100/50 shadow-sm backdrop-blur-sm">
                                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-[10px] font-bold text-emerald-600">Sistem Aktif</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10 w-full mb-8">
                                    <h3 className="text-[22px] font-black text-slate-900 mb-2 tracking-tight line-clamp-1 group-hover:text-emerald-700 transition-colors duration-300">{agent.name || "İsimsiz Asistan"}</h3>

                                    <div className="flex items-center justify-between w-full p-3 bg-slate-50/60 rounded-xl border border-slate-100 mb-4 group-hover:bg-white/80 transition-colors shadow-inner backdrop-blur-sm">
                                        <p className="text-[11px] text-slate-500 font-medium font-mono truncate text-ellipsis" title={agent.agent_id}>
                                            Sistem ID: <span className="text-slate-700 font-bold ml-1">{agent.agent_id}</span>
                                        </p>
                                    </div>

                                    {/* Real Metrics */}
                                    {(() => {
                                        const s = getStats(agent.agent_id);
                                        return (
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold bg-white/60 border border-slate-100 shadow-sm p-2.5 rounded-xl">
                                                    <Phone className="w-4 h-4 text-emerald-500" />
                                                    <span className="truncate">{s.total} Arama</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold bg-white/60 border border-slate-100 shadow-sm p-2.5 rounded-xl">
                                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                                    <span className="truncate">%{s.answerRate} Yanıt</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold bg-white/60 border border-slate-100 shadow-sm p-2.5 rounded-xl">
                                                    <Clock className="w-4 h-4 text-sky-500" />
                                                    <span className="truncate">{formatDuration(s.avgDuration)} ort.</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold bg-white/60 border border-slate-100 shadow-sm p-2.5 rounded-xl">
                                                    <Calendar className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate">{formatDate(agent.created_at_unix_secs)}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="flex flex-col gap-3 w-full mt-auto relative z-10">
                                    <button
                                        onClick={() => setVoiceDemoAgent(agent)}
                                        className="w-full relative group/btn flex justify-center items-center gap-2.5 py-4 bg-slate-950 text-[#CCFF00] rounded-2xl font-bold text-sm tracking-wide overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.15)] hover:shadow-[0_8px_30px_rgba(204,255,0,0.25)] hover:bg-slate-900 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#CCFF00]/15 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                                        <Headphones className="w-4.5 h-4.5" /> Canlı Sesli Bağlantı
                                    </button>

                                    <button
                                        onClick={() => setEditingAgent(agent)}
                                        className="w-full flex justify-center items-center gap-2.5 py-3.5 bg-white/50 border-2 border-slate-200 text-slate-700 rounded-2xl font-bold text-sm tracking-wide hover:border-slate-800 hover:text-slate-900 hover:bg-white hover:shadow-md transition-all active:scale-[0.98]"
                                    >
                                        <Settings2 className="w-4 h-4" /> Karakteri Yapılandır
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Premium Editing Agent Modal */}
            {editingAgent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 xl:p-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-4xl h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden relative border border-white/80 ring-1 ring-slate-900/5">

                        {/* Decorative Header Sparkles */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#CCFF00]" />

                        {/* Modal Header */}
                        <div className="px-10 py-8 border-b border-slate-100 flex items-start justify-between bg-white/60 flex-shrink-0">
                            <div>
                                <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg transform -rotate-2">
                                        <Bot className="w-6 h-6 text-[#CCFF00]" />
                                    </div>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-700">{editingAgent.name}</span>
                                    <span className="font-semibold text-slate-400 text-xl ml-1 tracking-normal">/ Kural Modifikasyonu</span>
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    Bu asistanın davranış profili güvenle kontrol altındadır.
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingAgent(null)}
                                className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm active:scale-90"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Editor Component Mount */}
                        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                            <div className="w-full h-full">
                                <AgentPromptEditor
                                    agentId={editingAgent.agent_id}
                                    apiKey={editingAgent.agent_id === LUNA_AGENT_ID ? LUNA_API_KEY : undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Agent Modal */}
            {duplicatingAgent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-[#CCFF00]" />
                        <div className="px-8 pt-8 pb-6">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-inner">
                                    <Copy className="w-6 h-6 text-indigo-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Asistanı Kopyala</h3>
                                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                                        <span className="font-bold text-slate-700">{duplicatingAgent.name || "İsimsiz"}</span> şablon olarak kullanılacak
                                    </p>
                                </div>
                            </div>
                            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Yeni Asistan Adı</label>
                            <input
                                type="text"
                                value={duplicateName}
                                onChange={e => setDuplicateName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && duplicateName.trim() && !isDuplicating) handleConfirmDuplicate(); }}
                                autoFocus
                                disabled={isDuplicating}
                                placeholder="Örn: Zeynep (Satış)"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                            />
                            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                Prompt, ses, analiz kriterleri ve bilgi bankası bağlantıları kopyalanır. Geçmiş aramalar kopyalanmaz.
                            </p>
                            {duplicateError && (
                                <div className="mt-4 text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2">
                                    <X className="w-4 h-4 shrink-0 mt-0.5" /> {duplicateError}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setDuplicatingAgent(null); setDuplicateError(null); }}
                                disabled={isDuplicating}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Vazgeç
                            </button>
                            <button
                                onClick={handleConfirmDuplicate}
                                disabled={isDuplicating || !duplicateName.trim()}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all shadow-[0_8px_20px_rgba(79,70,229,0.2)]",
                                    isDuplicating || !duplicateName.trim()
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 active:scale-95"
                                )}
                            >
                                {isDuplicating ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Kopyalanıyor...</>
                                ) : (
                                    <><Copy className="w-4 h-4" /> Kopyala</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingAgent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-400" />
                        <div className="px-8 pt-8 pb-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 shadow-inner">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Asistanı Sil</h3>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                <span className="font-black text-slate-900">{deletingAgent.name || "İsimsiz Asistan"}</span> isimli asistan kalıcı olarak silinecek. Bu işlem geri alınamaz.
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 mt-2 break-all">
                                {deletingAgent.agent_id}
                            </p>
                            {deleteError && (
                                <div className="mt-4 w-full text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2 text-left">
                                    <X className="w-4 h-4 shrink-0 mt-0.5" /> {deleteError}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setDeletingAgent(null); setDeleteError(null); }}
                                disabled={isDeleting}
                                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Vazgeç
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-white transition-all shadow-[0_8px_20px_rgba(220,38,38,0.25)]",
                                    isDeleting ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 active:scale-95"
                                )}
                            >
                                {isDeleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Siliniyor...</>
                                ) : (
                                    <><Trash2 className="w-4 h-4" /> Evet, Sil</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create New Agent Modal */}
            <CreateAgentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreated={fetchAgents}
            />

            {/* Secure Voice Agent Demo Modal */}
            <VoiceAgentDemoModal
                isOpen={voiceDemoAgent !== null}
                onClose={() => setVoiceDemoAgent(null)}
                campaignName={"Sistem Doğrulama: " + (voiceDemoAgent?.name || "")}
                agentId={voiceDemoAgent?.agent_id}
                agentRole={voiceDemoAgent?.name}
            />
        </div>
    );
};
