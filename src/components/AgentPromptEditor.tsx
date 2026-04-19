import { useState, useEffect, useRef } from "react";
import {
    getAgentConfigData,
    updateAgentConfigData,
    getVoices,
    VoiceListItem,
    VoiceSettings,
    DEFAULT_VOICE_SETTINGS,
    EvaluationCriterion,
    DataCollectionField,
    DataCollectionType,
    KnowledgeBaseRef,
    KnowledgeBaseDocument,
    listKnowledgeBase,
    uploadKnowledgeBaseFile,
    uploadKnowledgeBaseUrl,
    uploadKnowledgeBaseText,
    deleteKnowledgeBase,
} from "@/services/elevenlabsApi";
import {
    Save, AlertCircle, Loader2, Mic, Volume2, Square,
    Target, Database, Plus, Trash2, Sparkles,
    BookOpen, FileText, Link as LinkIcon, Upload, Globe, Type,
    SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { cn } from "@/utils/cn";

interface AgentPromptEditorProps {
    agentId?: string;
    agentRole?: string;
    apiKey?: string;
}

type Tab = "behavior" | "voice" | "analysis" | "knowledge";

const uid = () =>
    (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

export const AgentPromptEditor = ({ agentId, agentRole, apiKey }: AgentPromptEditorProps) => {
    const [tab, setTab] = useState<Tab>("behavior");

    const [prompt, setPrompt] = useState("");
    const [firstMessage, setFirstMessage] = useState("");
    const [voiceId, setVoiceId] = useState("");
    const [initialVoiceId, setInitialVoiceId] = useState("");
    const [voices, setVoices] = useState<VoiceListItem[]>([]);
    const [voiceFilter, setVoiceFilter] = useState<"TR" | "ALL">("TR");
    const [voiceSettings, setVoiceSettings] = useState<Required<VoiceSettings>>({ ...DEFAULT_VOICE_SETTINGS });
    const [initialVoiceSettings, setInitialVoiceSettings] = useState<Required<VoiceSettings>>({ ...DEFAULT_VOICE_SETTINGS });

    const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
    const [dataFields, setDataFields] = useState<DataCollectionField[]>([]);

    // Knowledge base
    const [attachedKB, setAttachedKB] = useState<KnowledgeBaseRef[]>([]);
    const [ragEnabled, setRagEnabled] = useState(false);
    const [workspaceKB, setWorkspaceKB] = useState<KnowledgeBaseDocument[]>([]);
    const [kbLoading, setKbLoading] = useState(false);
    const [kbUploading, setKbUploading] = useState(false);
    const [kbError, setKbError] = useState<string | null>(null);
    const [kbUploadMode, setKbUploadMode] = useState<"file" | "url" | "text">("file");
    const [kbUrlInput, setKbUrlInput] = useState("");
    const [kbTextName, setKbTextName] = useState("");
    const [kbTextBody, setKbTextBody] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Audio playback
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = (voice: VoiceListItem) => {
        if (playingVoiceId === voice.voice_id) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            if (voice.preview_url) {
                const audio = new Audio(voice.preview_url);
                audioRef.current = audio;
                audio.play().catch(e => console.log("Audio play failed", e));
                setPlayingVoiceId(voice.voice_id);
                audio.onended = () => setPlayingVoiceId(null);
            }
        }
    };

    useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

    useEffect(() => {
        if (!agentId) return;

        let isMounted = true;
        const fetchAll = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [configData, voicesData, kbList] = await Promise.all([
                    getAgentConfigData(agentId, apiKey),
                    getVoices().catch(() => [] as VoiceListItem[]),
                    listKnowledgeBase().catch(() => [] as KnowledgeBaseDocument[]),
                ]);
                if (isMounted) {
                    setPrompt(configData.prompt);
                    setFirstMessage(configData.firstMessage);
                    setVoiceId(configData.voiceId);
                    setInitialVoiceId(configData.voiceId);
                    const vs: Required<VoiceSettings> = {
                        stability: configData.voiceSettings.stability ?? DEFAULT_VOICE_SETTINGS.stability,
                        similarity_boost: configData.voiceSettings.similarity_boost ?? DEFAULT_VOICE_SETTINGS.similarity_boost,
                        style: configData.voiceSettings.style ?? DEFAULT_VOICE_SETTINGS.style,
                        use_speaker_boost: configData.voiceSettings.use_speaker_boost ?? DEFAULT_VOICE_SETTINGS.use_speaker_boost,
                        speed: configData.voiceSettings.speed ?? DEFAULT_VOICE_SETTINGS.speed,
                    };
                    setVoiceSettings(vs);
                    setInitialVoiceSettings(vs);
                    setCriteria(configData.evaluationCriteria);
                    setDataFields(configData.dataCollection);
                    setAttachedKB(configData.knowledgeBase);
                    setRagEnabled(configData.ragEnabled);
                    setVoices(voicesData);
                    setWorkspaceKB(kbList);
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || "Ajan bilgileri alınamadı.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchAll();
        return () => { isMounted = false; };
    }, [agentId]);

    const handleSave = async () => {
        if (!agentId || !prompt.trim()) return;

        // Validate data collection field names (snake_case-ish)
        const invalidField = dataFields.find(
            f => f.name.trim() && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.name.trim())
        );
        if (invalidField) {
            setError(`Veri alanı adı geçersiz: "${invalidField.name}". Sadece harf, rakam ve _ kullanın. Boşluk olmamalı.`);
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const voiceChanged = voiceId && voiceId !== initialVoiceId;
            const vsChanged =
                voiceSettings.stability !== initialVoiceSettings.stability ||
                voiceSettings.similarity_boost !== initialVoiceSettings.similarity_boost ||
                voiceSettings.style !== initialVoiceSettings.style ||
                voiceSettings.use_speaker_boost !== initialVoiceSettings.use_speaker_boost ||
                voiceSettings.speed !== initialVoiceSettings.speed;
            await updateAgentConfigData(agentId, prompt, firstMessage, apiKey, {
                voiceId: voiceChanged ? voiceId : undefined,
                voiceSettings: vsChanged ? voiceSettings : undefined,
                evaluationCriteria: criteria,
                dataCollection: dataFields,
                knowledgeBase: attachedKB,
                ragEnabled,
            });
            if (voiceChanged) setInitialVoiceId(voiceId);
            if (vsChanged) setInitialVoiceSettings(voiceSettings);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "Kaydedilirken hata oluştu.");
        } finally {
            setIsSaving(false);
        }
    };

    // Criteria operations
    const addCriterion = () =>
        setCriteria(prev => [
            ...prev,
            { id: uid(), name: "", conversation_goal_prompt: "", type: "prompt" },
        ]);
    const updateCriterion = (id: string, patch: Partial<EvaluationCriterion>) =>
        setCriteria(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
    const removeCriterion = (id: string) =>
        setCriteria(prev => prev.filter(c => c.id !== id));

    // Data field operations
    const addField = () =>
        setDataFields(prev => [
            ...prev,
            { name: "", type: "string", description: "" },
        ]);
    const updateField = (idx: number, patch: Partial<DataCollectionField>) =>
        setDataFields(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    const removeField = (idx: number) =>
        setDataFields(prev => prev.filter((_, i) => i !== idx));

    // Knowledge base operations
    const refreshWorkspaceKB = async () => {
        setKbLoading(true);
        try {
            const list = await listKnowledgeBase();
            setWorkspaceKB(list);
        } catch {
            /* ignore */
        } finally {
            setKbLoading(false);
        }
    };

    const attachKB = (doc: KnowledgeBaseDocument) => {
        if (attachedKB.some(k => k.id === doc.id)) return;
        setAttachedKB(prev => [
            ...prev,
            { id: doc.id, name: doc.name, type: doc.type, usage_mode: "auto" },
        ]);
    };

    const detachKB = (id: string) =>
        setAttachedKB(prev => prev.filter(k => k.id !== id));

    const handleKBFileUpload = async (file: File) => {
        setKbError(null);
        setKbUploading(true);
        try {
            const doc = await uploadKnowledgeBaseFile(file);
            setWorkspaceKB(prev => [doc, ...prev]);
            attachKB(doc);
        } catch (err: any) {
            setKbError(err.message || "Dosya yüklenemedi.");
        } finally {
            setKbUploading(false);
        }
    };

    const handleKBUrlAdd = async () => {
        if (!kbUrlInput.trim()) return;
        setKbError(null);
        setKbUploading(true);
        try {
            const doc = await uploadKnowledgeBaseUrl(kbUrlInput.trim());
            setWorkspaceKB(prev => [doc, ...prev]);
            attachKB(doc);
            setKbUrlInput("");
        } catch (err: any) {
            setKbError(err.message || "URL eklenemedi.");
        } finally {
            setKbUploading(false);
        }
    };

    const handleKBTextAdd = async () => {
        if (!kbTextName.trim() || !kbTextBody.trim()) return;
        setKbError(null);
        setKbUploading(true);
        try {
            const doc = await uploadKnowledgeBaseText(kbTextBody.trim(), kbTextName.trim());
            setWorkspaceKB(prev => [doc, ...prev]);
            attachKB(doc);
            setKbTextName("");
            setKbTextBody("");
        } catch (err: any) {
            setKbError(err.message || "Metin eklenemedi.");
        } finally {
            setKbUploading(false);
        }
    };

    const handleKBWorkspaceDelete = async (id: string) => {
        if (!confirm("Bu dokümanı workspace'ten kalıcı olarak silmek istiyor musunuz?")) return;
        try {
            await deleteKnowledgeBase(id);
            setWorkspaceKB(prev => prev.filter(d => d.id !== id));
            setAttachedKB(prev => prev.filter(k => k.id !== id));
        } catch (err: any) {
            setKbError(err.message || "Silinemedi.");
        }
    };

    if (!agentId) {
        return (
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-orange-800">Ajan Tanımlı Değil</h4>
                    <p className="text-xs text-orange-600 mt-1">Bu kampanya için geçerli bir Asistan ID'si bulunmuyor.</p>
                </div>
            </div>
        );
    }

    const filteredVoices = voices.filter(
        v => voiceFilter === "ALL" || v.labels?.language === "tr" || v.category === "cloned" || v.category === "professional"
    );

    const tabs: { id: Tab; label: string; icon: any }[] = [
        { id: "behavior", label: "Davranış", icon: Sparkles },
        { id: "voice", label: "Ses", icon: Mic },
        { id: "analysis", label: "Analiz & Hedefler", icon: Target },
        { id: "knowledge", label: "Bilgi Bankası", icon: BookOpen },
    ];

    const kbTypeIcon = (type: string) => {
        if (type === "url") return <Globe className="w-3.5 h-3.5 text-blue-500" />;
        if (type === "text") return <Type className="w-3.5 h-3.5 text-amber-500" />;
        return <FileText className="w-3.5 h-3.5 text-emerald-500" />;
    };

    const availableKB = workspaceKB.filter(d => !attachedKB.some(k => k.id === d.id));

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 relative">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Asistan Ayarları
                    {agentRole && <span className="text-xs font-bold px-2 py-1 bg-slate-200 text-slate-700 rounded-lg">{agentRole}</span>}
                </h4>
                {success && <span className="text-xs font-bold text-emerald-500 animate-in fade-in">Başarıyla Kaydedildi ✓</span>}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-5 bg-white border border-slate-200 p-1 rounded-xl w-fit">
                {tabs.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                                active ? "bg-slate-900 text-[#CCFF00] shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {isLoading ? (
                <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center border border-slate-200">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
            ) : (
                <div className="relative flex flex-col gap-6">
                    {/* ── BEHAVIOR TAB ── */}
                    {tab === "behavior" && (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">İlk Mesaj (Açılış Cümlesi)</label>
                                <p className="text-[11px] text-slate-500 mb-2">Asistan çağrı başladığında karşı tarafa ilk bu cümleyi söyleyecek.</p>
                                <textarea
                                    value={firstMessage}
                                    onChange={(e) => setFirstMessage(e.target.value)}
                                    className="w-full h-24 p-3.5 rounded-xl bg-white border border-slate-300 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-sm custom-scrollbar"
                                    placeholder="Merhaba, size nasıl yardımcı olabilirim?"
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Ajan Karakteri (System Prompt)</label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="w-full h-64 p-4 rounded-xl bg-white border border-slate-300 text-sm focus:border-[#CCFF00] focus:ring-4 focus:ring-[#CCFF00]/20 transition-all resize-none shadow-inner custom-scrollbar"
                                    placeholder="Ajan talimatlarını girin..."
                                    disabled={isSaving}
                                />
                            </div>
                        </>
                    )}

                    {/* ── VOICE TAB ── */}
                    {tab === "voice" && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-700">Ses Profili</label>
                                {voiceId !== initialVoiceId && (
                                    <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-md">DEĞİŞTİRİLDİ</span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 mb-2">Asistanın sesini değiştirin. Karar vermeden önce dinleyebilirsiniz.</p>

                            <div className="flex items-center gap-2 mb-3 bg-slate-100 p-1 rounded-xl w-fit">
                                <button
                                    type="button"
                                    onClick={() => setVoiceFilter("TR")}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                        voiceFilter === "TR" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🇹🇷 Türkçe & Özel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVoiceFilter("ALL")}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                        voiceFilter === "ALL" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    🌍 Tümü
                                </button>
                            </div>

                            <div className="h-72 overflow-y-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white p-2 flex flex-col gap-2">
                                {filteredVoices.length === 0 && (
                                    <div className="flex items-center justify-center h-full text-xs text-slate-400">
                                        Ses bulunamadı.
                                    </div>
                                )}
                                {filteredVoices.map(v => (
                                    <div
                                        key={v.voice_id}
                                        onClick={() => setVoiceId(v.voice_id)}
                                        className={cn(
                                            "flex items-center justify-between p-2.5 rounded-xl border-2 cursor-pointer transition-colors duration-150",
                                            voiceId === v.voice_id
                                                ? "bg-[#CCFF00]/10 border-[#CCFF00]"
                                                : "bg-white border-transparent hover:bg-slate-50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                                voiceId === v.voice_id ? "bg-[#CCFF00] text-slate-900" : "bg-slate-100 text-slate-500"
                                            )}>
                                                <Mic className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-extrabold text-slate-800 text-sm leading-tight">{v.name}</span>
                                                <span className="text-[11px] text-slate-500 mt-0.5 capitalize">
                                                    {v.labels?.gender || "Global"} • {v.labels?.accent || v.category}
                                                </span>
                                            </div>
                                        </div>

                                        {v.preview_url && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); togglePlay(v); }}
                                                className={cn(
                                                    "p-2.5 rounded-xl transition-colors",
                                                    playingVoiceId === v.voice_id
                                                        ? "bg-slate-900 text-[#CCFF00]"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                                title="Sesi Dinle"
                                            >
                                                {playingVoiceId === v.voice_id ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Voice fine-tuning sliders */}
                            <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                                            Ses İnce Ayarları
                                        </h5>
                                        <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                                            Sentezleyicinin karakterini ayarlayın. Değişiklikler yalnızca bu ajan için uygulanır.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setVoiceSettings({ ...DEFAULT_VOICE_SETTINGS })}
                                        disabled={isSaving}
                                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
                                        title="Varsayılanlara döndür"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {([
                                        { key: "stability" as const, label: "Kararlılık", hint: "Düşük: daha duygusal. Yüksek: daha tutarlı.", min: 0, max: 1, step: 0.01, fmt: (n: number) => `%${Math.round(n * 100)}` },
                                        { key: "similarity_boost" as const, label: "Benzerlik Artırma", hint: "Orijinal sese ne kadar sadık kalınacağı.", min: 0, max: 1, step: 0.01, fmt: (n: number) => `%${Math.round(n * 100)}` },
                                        { key: "style" as const, label: "Stil Yoğunluğu", hint: "Orijinal konuşmacının stilini taklit etme oranı. Yüksek = daha fazla gecikme.", min: 0, max: 1, step: 0.01, fmt: (n: number) => `%${Math.round(n * 100)}` },
                                        { key: "speed" as const, label: "Konuşma Hızı", hint: "0.7 yavaş, 1.2 hızlı.", min: 0.7, max: 1.2, step: 0.01, fmt: (n: number) => `${n.toFixed(2)}x` },
                                    ]).map(s => (
                                        <div key={s.key}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-slate-700">{s.label}</label>
                                                <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {s.fmt(voiceSettings[s.key] as number)}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={s.min}
                                                max={s.max}
                                                step={s.step}
                                                value={voiceSettings[s.key] as number}
                                                onChange={e => setVoiceSettings(v => ({ ...v, [s.key]: parseFloat(e.target.value) }))}
                                                disabled={isSaving}
                                                className="w-full accent-[#CCFF00]"
                                            />
                                            <p className="text-[10px] text-slate-400 mt-0.5">{s.hint}</p>
                                        </div>
                                    ))}

                                    {/* Speaker boost toggle */}
                                    <div className="flex items-start justify-between pt-3 border-t border-slate-100">
                                        <div className="min-w-0 mr-3">
                                            <label className="text-xs font-bold text-slate-700">Hoparlör Güçlendirme</label>
                                            <p className="text-[10px] text-slate-400 mt-0.5">Seçilen ses profiline benzerliği artırır ama işleme süresini biraz uzatır.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={voiceSettings.use_speaker_boost}
                                                onChange={e => setVoiceSettings(v => ({ ...v, use_speaker_boost: e.target.checked }))}
                                                disabled={isSaving}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#CCFF00]/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ANALYSIS TAB ── */}
                    {tab === "analysis" && (
                        <div className="flex flex-col gap-6">
                            {/* Evaluation Criteria */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <Target className="w-4 h-4 text-emerald-500" />
                                            Değerlendirme Kriterleri
                                        </h5>
                                        <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                                            Her aramadan sonra AI bu kriterleri transkript üzerinden değerlendirir: <span className="font-bold">başarılı / başarısız / belirsiz</span>.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addCriterion}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-[#CCFF00] text-xs font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Kriter Ekle
                                    </button>
                                </div>

                                {criteria.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        Henüz kriter eklenmedi. Örn: "Müşteri randevu kabul etti mi?"
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {criteria.map(c => (
                                            <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={c.name}
                                                        onChange={(e) => updateCriterion(c.id, { name: e.target.value })}
                                                        placeholder="Kriter adı (örn: Randevu alındı)"
                                                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                                        disabled={isSaving}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCriterion(c.id)}
                                                        className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={c.conversation_goal_prompt}
                                                    onChange={(e) => updateCriterion(c.id, { conversation_goal_prompt: e.target.value })}
                                                    placeholder="Değerlendirme talimatı (örn: Müşteri net bir şekilde randevu aldıysa başarılı; belirsiz ise unknown; reddettiyse başarısız.)"
                                                    className="w-full h-20 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none resize-none"
                                                    disabled={isSaving}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Data Collection */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <Database className="w-4 h-4 text-indigo-500" />
                                            Veri Toplama
                                        </h5>
                                        <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                                            AI konuşmadan yapılandırılmış veri çıkarır. Örn: <span className="font-mono">randevu_tarihi</span>, <span className="font-mono">butce</span>, <span className="font-mono">musteri_adi</span>.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addField}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-[#CCFF00] text-xs font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Alan Ekle
                                    </button>
                                </div>

                                {dataFields.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        Henüz alan tanımlanmadı.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {dataFields.map((f, idx) => (
                                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={f.name}
                                                        onChange={(e) => updateField(idx, { name: e.target.value.replace(/\s+/g, "_") })}
                                                        placeholder="alan_adi (harf, rakam, _)"
                                                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-bold font-mono focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                                        disabled={isSaving}
                                                    />
                                                    <select
                                                        value={f.type}
                                                        onChange={(e) => updateField(idx, { type: e.target.value as DataCollectionType })}
                                                        className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-bold focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                                        disabled={isSaving}
                                                    >
                                                        <option value="string">metin</option>
                                                        <option value="number">sayı</option>
                                                        <option value="integer">tam sayı</option>
                                                        <option value="boolean">evet/hayır</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeField(idx)}
                                                        className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                        title="Sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={f.description}
                                                    onChange={(e) => updateField(idx, { description: e.target.value })}
                                                    placeholder="Açıklama (örn: Müşterinin tercih ettiği randevu tarihi ve saati)"
                                                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                                    disabled={isSaving}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── KNOWLEDGE TAB ── */}
                    {tab === "knowledge" && (
                        <div className="flex flex-col gap-6">
                            {/* RAG toggle */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4">
                                <div>
                                    <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        RAG (Anlamsal Arama)
                                    </h5>
                                    <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                                        Açık olduğunda ajan, konuşma sırasında dokümanlardan sadece ilgili parçaları çeker. Büyük dokümanlar için önerilir.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={ragEnabled}
                                        onChange={e => setRagEnabled(e.target.checked)}
                                        disabled={isSaving}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#CCFF00]/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                                </label>
                            </div>

                            {/* Attached documents */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h5 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                                    <BookOpen className="w-4 h-4 text-emerald-500" />
                                    Bu Ajana Bağlı Dokümanlar
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{attachedKB.length}</span>
                                </h5>

                                {attachedKB.length === 0 ? (
                                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        Henüz doküman bağlanmadı. Aşağıdan ekleyin.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {attachedKB.map(k => (
                                            <div key={k.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {kbTypeIcon(k.type)}
                                                    <span className="text-sm font-bold text-slate-800 truncate">{k.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded uppercase">{k.type}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => detachKB(k.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                    title="Bu ajandan çıkar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Upload */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                <h5 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                                    <Upload className="w-4 h-4 text-indigo-500" />
                                    Yeni Doküman Ekle
                                </h5>

                                <div className="flex items-center gap-1 mb-4 bg-slate-100 p-1 rounded-xl w-fit">
                                    {([
                                        { id: "file" as const, label: "Dosya", icon: FileText },
                                        { id: "url" as const, label: "URL", icon: Globe },
                                        { id: "text" as const, label: "Metin", icon: Type },
                                    ]).map(m => {
                                        const Icon = m.icon;
                                        const active = kbUploadMode === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setKbUploadMode(m.id)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                                    active ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5" /> {m.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {kbUploadMode === "file" && (
                                    <label className={cn(
                                        "block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors",
                                        kbUploading && "opacity-50 pointer-events-none"
                                    )}>
                                        <input
                                            type="file"
                                            accept=".pdf,.txt,.docx,.doc,.md,.html,.csv"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleKBFileUpload(f);
                                                e.target.value = "";
                                            }}
                                            disabled={kbUploading || isSaving}
                                        />
                                        {kbUploading ? (
                                            <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                                <p className="text-sm font-bold text-slate-700">Dosya seçmek için tıklayın</p>
                                                <p className="text-[11px] text-slate-500 mt-1">PDF, DOCX, TXT, MD, HTML, CSV</p>
                                            </>
                                        )}
                                    </label>
                                )}

                                {kbUploadMode === "url" && (
                                    <div className="flex gap-2">
                                        <div className="flex-1 relative">
                                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="url"
                                                value={kbUrlInput}
                                                onChange={e => setKbUrlInput(e.target.value)}
                                                placeholder="https://..."
                                                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                                disabled={kbUploading || isSaving}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleKBUrlAdd}
                                            disabled={kbUploading || !kbUrlInput.trim()}
                                            className={cn(
                                                "px-4 py-2.5 rounded-lg font-bold text-sm transition-colors",
                                                kbUploading || !kbUrlInput.trim()
                                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                    : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800"
                                            )}
                                        >
                                            {kbUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ekle"}
                                        </button>
                                    </div>
                                )}

                                {kbUploadMode === "text" && (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={kbTextName}
                                            onChange={e => setKbTextName(e.target.value)}
                                            placeholder="Doküman adı (örn: SSS, Fiyat Listesi)"
                                            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none"
                                            disabled={kbUploading || isSaving}
                                        />
                                        <textarea
                                            value={kbTextBody}
                                            onChange={e => setKbTextBody(e.target.value)}
                                            placeholder="Metni yapıştırın..."
                                            className="w-full h-32 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:border-[#CCFF00] focus:ring-2 focus:ring-[#CCFF00]/20 outline-none resize-none custom-scrollbar"
                                            disabled={kbUploading || isSaving}
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleKBTextAdd}
                                                disabled={kbUploading || !kbTextName.trim() || !kbTextBody.trim()}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg font-bold text-sm transition-colors",
                                                    kbUploading || !kbTextName.trim() || !kbTextBody.trim()
                                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                        : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800"
                                                )}
                                            >
                                                {kbUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Metni Ekle"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {kbError && (
                                    <div className="mt-3 text-xs text-red-500 font-semibold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> {kbError}
                                    </div>
                                )}
                            </div>

                            {/* Existing workspace docs */}
                            {availableKB.length > 0 && (
                                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            <Database className="w-4 h-4 text-slate-500" />
                                            Diğer Dokümanlar (Workspace)
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{availableKB.length}</span>
                                        </h5>
                                        <button
                                            type="button"
                                            onClick={refreshWorkspaceKB}
                                            disabled={kbLoading}
                                            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
                                        >
                                            <Loader2 className={cn("w-3 h-3", kbLoading && "animate-spin")} /> Yenile
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-3">Daha önce yüklenmiş, bu ajana bağlı olmayan dokümanlar. Bağlamak için tıklayın.</p>
                                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {availableKB.map(d => (
                                            <div key={d.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 hover:bg-white transition-colors">
                                                <button
                                                    type="button"
                                                    onClick={() => attachKB(d)}
                                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                                >
                                                    {kbTypeIcon(d.type)}
                                                    <span className="text-sm font-bold text-slate-800 truncate">{d.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded uppercase">{d.type}</span>
                                                </button>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => attachKB(d)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-[#CCFF00]/20 hover:text-slate-900 transition-colors"
                                                        title="Bu ajana bağla"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleKBWorkspaceDelete(d.id)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                                        title="Workspace'ten kalıcı sil"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="mt-1 text-xs text-red-500 font-semibold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <div className="flex justify-end mt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !prompt.trim()}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm",
                                isSaving || !prompt.trim()
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Değişiklikleri Publish Et
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
