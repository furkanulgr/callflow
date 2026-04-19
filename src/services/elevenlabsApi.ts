const API_BASE = 'https://api.elevenlabs.io';

const getApiKey = () => import.meta.env.VITE_ELEVENLABS_API_KEY as string;

/** Satış birim fiyatı: her karakter için TL cinsinden maliyet (müşteriye yansıyan). */
export const CHAR_RATE_TRY = parseFloat(
    (import.meta.env.VITE_CHAR_RATE_TRY as string) || "0.012"
);
/** Ortalama karakter / dakika (TTS). Dakika tahmini için kullanılır. */
export const CHARS_PER_MINUTE = 1000;

export interface UserSubscription {
    tier: string;
    status: string;
    character_count: number;
    character_limit: number;
    can_extend_character_limit?: boolean;
    next_character_count_reset_unix?: number;
    voice_limit?: number;
    currency?: string;
    allowed_to_extend_character_limit?: boolean;
}

/**
 * Fetches the current user's subscription info (character quota, tier, reset date).
 */
export const getUserSubscription = async (): Promise<UserSubscription> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/user/subscription`, {
        method: "GET",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Subscription API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
};

export interface CharacterUsageStats {
    time: number[];         // unix secs
    usage: Record<string, number[]>; // per-voice or total; sum across keys
}

/**
 * Fetches character usage over a time window (for charts).
 * Defaults to last 30 days if no params.
 */
export const getCharacterUsage = async (
    startUnixSecs?: number,
    endUnixSecs?: number
): Promise<CharacterUsageStats> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const now = Math.floor(Date.now() / 1000);
    const start = startUnixSecs ?? now - 30 * 24 * 3600;
    const end = endUnixSecs ?? now;

    const qs = new URLSearchParams({
        start_unix: String(start * 1000),
        end_unix: String(end * 1000),
        breakdown_type: "voice",
    });

    const response = await fetch(
        `${API_BASE}/v1/usage/character-stats?${qs.toString()}`,
        { method: "GET", headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Usage stats API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
};

// LUNA agent — separate ElevenLabs account (loaded from env)
export const LUNA_API_KEY = import.meta.env.VITE_LUNA_API_KEY as string;
export const LUNA_AGENT_ID = import.meta.env.VITE_LUNA_AGENT_ID as string;

export interface AgentConfig {
    agent_id: string;
    conversation_config: {
        agent: {
            prompt: {
                prompt: string;
            };
            first_message?: string;
        }
    };
    [key: string]: any;
}

/** Evaluation criterion — LLM grades each call against this goal after completion. */
export interface EvaluationCriterion {
    id: string;
    name: string;
    conversation_goal_prompt: string;
    type?: "prompt";
}

/** Data collection field — LLM extracts structured value from transcript after call. */
export type DataCollectionType = "string" | "number" | "integer" | "boolean";
export interface DataCollectionField {
    /** Logical key used in API response. Generated/set by UI. */
    name: string;
    type: DataCollectionType;
    description: string;
}

/** Reference to a knowledge base document attached to an agent. */
export type KnowledgeBaseDocType = "file" | "url" | "text";
export interface KnowledgeBaseRef {
    id: string;
    name: string;
    type: KnowledgeBaseDocType;
    usage_mode?: "auto" | "prompt";
}

/** TTS synthesis fine-tuning per agent. All fields optional. */
export interface VoiceSettings {
    stability?: number;         // 0..1
    similarity_boost?: number;  // 0..1
    style?: number;             // 0..1
    use_speaker_boost?: boolean;
    speed?: number;             // 0.7..1.2
}

export const DEFAULT_VOICE_SETTINGS: Required<VoiceSettings> = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: true,
    speed: 1.0,
};

export interface AgentFullConfig {
    prompt: string;
    firstMessage: string;
    voiceId: string;
    voiceSettings: VoiceSettings;
    evaluationCriteria: EvaluationCriterion[];
    dataCollection: DataCollectionField[];
    knowledgeBase: KnowledgeBaseRef[];
    ragEnabled: boolean;
}

/**
 * Fetches the specific agent configuration via the ElevenLabs REST API.
 */
export const getAgentConfigData = async (
    agentId: string,
    apiKeyOverride?: string
): Promise<AgentFullConfig> => {
    const apiKey = apiKeyOverride || getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/agents/${agentId}`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }

    const data: AgentConfig = await response.json();
    const prompt = data.conversation_config?.agent?.prompt?.prompt || "";
    const firstMessage = data.conversation_config?.agent?.first_message || "";
    const tts = data.conversation_config?.tts || {};
    const voiceId = tts.voice_id || "";
    const voiceSettings: VoiceSettings = {
        stability: typeof tts.stability === "number" ? tts.stability : DEFAULT_VOICE_SETTINGS.stability,
        similarity_boost: typeof tts.similarity_boost === "number" ? tts.similarity_boost : DEFAULT_VOICE_SETTINGS.similarity_boost,
        style: typeof tts.style === "number" ? tts.style : DEFAULT_VOICE_SETTINGS.style,
        use_speaker_boost: typeof tts.use_speaker_boost === "boolean" ? tts.use_speaker_boost : DEFAULT_VOICE_SETTINGS.use_speaker_boost,
        speed: typeof tts.speed === "number" ? tts.speed : DEFAULT_VOICE_SETTINGS.speed,
    };

    // Evaluation criteria — stored under platform_settings.evaluation.criteria
    const rawCriteria: any[] = data.platform_settings?.evaluation?.criteria || [];
    const evaluationCriteria: EvaluationCriterion[] = rawCriteria.map(c => ({
        id: c.id || c.name || crypto.randomUUID(),
        name: c.name || "",
        conversation_goal_prompt: c.conversation_goal_prompt || c.prompt || "",
        type: "prompt",
    }));

    // Data collection — stored as an object map keyed by field name
    const rawDataCollection = data.platform_settings?.data_collection || {};
    const dataCollection: DataCollectionField[] = Object.entries(rawDataCollection).map(
        ([name, v]: [string, any]) => ({
            name,
            type: (v?.type as DataCollectionType) || "string",
            description: v?.description || "",
        })
    );

    // Knowledge base — list of docs attached to the agent's prompt
    const rawKB: any[] = data.conversation_config?.agent?.prompt?.knowledge_base || [];
    const knowledgeBase: KnowledgeBaseRef[] = rawKB.map(k => ({
        id: k.id,
        name: k.name || k.id,
        type: (k.type as KnowledgeBaseDocType) || "file",
        usage_mode: k.usage_mode,
    }));

    const ragEnabled: boolean = !!data.conversation_config?.agent?.prompt?.rag?.enabled;

    return { prompt, firstMessage, voiceId, voiceSettings, evaluationCriteria, dataCollection, knowledgeBase, ragEnabled };
};

export interface UpdateAgentConfigOptions {
    voiceId?: string;
    voiceSettings?: VoiceSettings;
    evaluationCriteria?: EvaluationCriterion[];
    dataCollection?: DataCollectionField[];
    knowledgeBase?: KnowledgeBaseRef[];
    ragEnabled?: boolean;
}

/**
 * Updates agent config via PATCH. Only fields explicitly provided are sent.
 * Supports prompt, first message, voice, evaluation criteria, data collection.
 */
export const updateAgentConfigData = async (
    agentId: string,
    newPrompt: string,
    newFirstMessage: string,
    apiKeyOverride?: string,
    options: UpdateAgentConfigOptions | string = {},
): Promise<void> => {
    const apiKey = apiKeyOverride || getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    // Backward compat: old callers passed `newVoiceId` string as 5th positional arg.
    const opts: UpdateAgentConfigOptions =
        typeof options === "string" ? { voiceId: options } : options;

    const payload: any = {
        conversation_config: {
            agent: {
                prompt: { prompt: newPrompt },
                first_message: newFirstMessage,
            },
        },
    };

    if (opts.voiceId || opts.voiceSettings) {
        const tts: any = payload.conversation_config.tts || {};
        if (opts.voiceId) tts.voice_id = opts.voiceId;
        if (opts.voiceSettings) {
            const vs = opts.voiceSettings;
            if (typeof vs.stability === "number") tts.stability = vs.stability;
            if (typeof vs.similarity_boost === "number") tts.similarity_boost = vs.similarity_boost;
            if (typeof vs.style === "number") tts.style = vs.style;
            if (typeof vs.use_speaker_boost === "boolean") tts.use_speaker_boost = vs.use_speaker_boost;
            if (typeof vs.speed === "number") tts.speed = vs.speed;
        }
        payload.conversation_config.tts = tts;
    }

    if (opts.knowledgeBase !== undefined || opts.ragEnabled !== undefined) {
        const promptBlock: any = payload.conversation_config.agent.prompt;
        if (opts.knowledgeBase !== undefined) {
            promptBlock.knowledge_base = opts.knowledgeBase.map(k => ({
                id: k.id,
                name: k.name,
                type: k.type,
                usage_mode: k.usage_mode || "auto",
            }));
        }
        if (opts.ragEnabled !== undefined) {
            promptBlock.rag = { enabled: opts.ragEnabled };
        }
    }

    if (opts.evaluationCriteria || opts.dataCollection) {
        payload.platform_settings = {};
        if (opts.evaluationCriteria) {
            payload.platform_settings.evaluation = {
                criteria: opts.evaluationCriteria.map(c => ({
                    id: c.id,
                    name: c.name,
                    type: "prompt",
                    conversation_goal_prompt: c.conversation_goal_prompt,
                })),
            };
        }
        if (opts.dataCollection) {
            payload.platform_settings.data_collection = Object.fromEntries(
                opts.dataCollection
                    .filter(f => f.name.trim())
                    .map(f => [
                        f.name.trim(),
                        { type: f.type, description: f.description },
                    ])
            );
        }
    }

    const response = await fetch(`${API_BASE}/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }
};

export interface AgentListItem {
    agent_id: string;
    name: string;
    created_at_unix_secs: number;
    [key: string]: any;
}

export interface AgentListResponse {
    agents: AgentListItem[];
    has_more: boolean;
    next_cursor: string | null;
}

/**
 * Fetches all available agents configured in the workspace.
 */
export const getAgents = async (): Promise<AgentListItem[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/agents`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }

    const data: AgentListResponse = await response.json();
    return data.agents || [];
};

/**
 * Deletes a conversational agent by ID.
 */
export const deleteAgent = async (agentId: string): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/agents/${agentId}`, {
        method: "DELETE",
        headers: {
            "xi-api-key": apiKey,
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }
};

export interface VoiceListItem {
    voice_id: string;
    name: string;
    category: string;
    preview_url?: string;
    labels?: {
        accent?: string;
        gender?: string;
        age?: string;
        use_case?: string;
        descriptive?: string;
        language?: string;
    };
}

export interface VoicesResponse {
    voices: VoiceListItem[];
}

/**
 * Fetches the available voices from ElevenLabs.
 */
export const getVoices = async (): Promise<VoiceListItem[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/voices`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }

    const data: VoicesResponse = await response.json();
    return data.voices || [];
};

export interface CreateAgentPayload {
    name: string;
    firstMessage: string;
    prompt: string;
    voiceId: string;
    model?: string;
}

/**
 * Creates a new conversational agent via POST request.
 */
export const createAgent = async (payload: CreateAgentPayload): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const apiPayload = {
        name: payload.name,
        conversation_config: {
            agent: {
                prompt: {
                    prompt: payload.prompt
                },
                first_message: payload.firstMessage,
                language: "tr"
            },
            tts: {
                voice_id: payload.voiceId,
                model_id: "eleven_turbo_v2_5"
            }
        }
    };

    const response = await fetch(`${API_BASE}/v1/convai/agents/create`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(apiPayload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API Error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.agent_id;
};

/**
 * Duplicates an existing agent. Copies the full conversation_config and
 * platform_settings from the source, then creates a fresh agent with the new name.
 * Returns the new agent_id.
 */
export const duplicateAgent = async (
    sourceAgentId: string,
    newName: string,
    apiKeyOverride?: string
): Promise<string> => {
    const apiKey = apiKeyOverride || getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    // 1. Fetch source full config
    const src = await fetch(`${API_BASE}/v1/convai/agents/${sourceAgentId}`, {
        method: "GET",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    });
    if (!src.ok) {
        const errText = await src.text();
        throw new Error(`Kaynak ajan okunamadı: ${src.status} - ${errText}`);
    }
    const srcData: any = await src.json();

    // 2. Build payload — keep everything except identity/audit fields
    const payload: any = {
        name: newName,
        conversation_config: srcData.conversation_config || {},
    };
    if (srcData.platform_settings) payload.platform_settings = srcData.platform_settings;
    if (srcData.tags) payload.tags = srcData.tags;

    // 3. POST create
    const res = await fetch(`${API_BASE}/v1/convai/agents/create`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ajan kopyalanamadı: ${res.status} - ${errText}`);
    }
    const data = await res.json();
    return data.agent_id;
};

export interface PhoneNumberItem {
    phone_number_id: string;
    phone_number: string;
    provider: string;
    label: string;
}

/**
 * Fetches configured phone numbers from ElevenLabs.
 */
export const getPhoneNumbers = async (): Promise<PhoneNumberItem[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/phone-numbers`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        // Handle no config or errors gracefully
        return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.phone_numbers || []);
};

/**
 * Fetches recent conversations.
 */
export const getConversations = async (agentId?: string): Promise<any[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");
    
    // Add agent_id filter if provided
    let url = `${API_BASE}/v1/convai/conversations`;
    if (agentId) {
        url += `?agent_id=${agentId}`;
    }

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey
        }
    });

    if (!response.ok) {
        return [];
    }

    const data = await response.json();
    return data.conversations || [];
};

/**
 * Fetches conversation details, including transcript.
 */
export const getConversationDetails = async (conversationId: string): Promise<any> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/conversations/${conversationId}`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey
        }
    });

    if (!response.ok) {
        throw new Error("Görüşme detayı alınamadı.");
    }

    return await response.json();
};

export interface BatchContact {
    phone_number: string;
    language?: string;
    voice_id?: string;
    first_message?: string;
    prompt?: string;
    [key: string]: string | undefined;
}

export interface BatchCallResult {
    batch_id: string;
    status: string;
    total_calls: number;
}

/**
 * Starts a batch calling campaign via ElevenLabs Batch Calling API.
 * Uploads the CSV file directly to the API.
 */
export const startBatchCalling = async (
    agentId: string,
    phoneNumberId: string,
    csvFile: File,
    batchName?: string
): Promise<BatchCallResult> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    // CSV dosyasını parse et
    const csvText = await csvFile.text();
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const phoneIndex = headers.findIndex(h => h === "phone_number");

    const recipients = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const recipient: Record<string, string> = {};
        headers.forEach((h, i) => {
            if (values[i]) recipient[h] = values[i];
        });
        // Sadece phone_number varsa da çalışsın
        if (phoneIndex === -1 && values[0]) {
            recipient["phone_number"] = values[0];
        }
        return recipient;
    }).filter(r => r.phone_number);

    const response = await fetch(
        `${API_BASE}/v1/convai/batch-calling/submit`,
        {
            method: "POST",
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                call_name: batchName || "Kampanya",
                agent_id: agentId,
                agent_phone_number_id: phoneNumberId,
                recipients,
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs Batch API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
};

export interface BatchRecipient {
    id?: string;
    phone_number: string;
    status: string; // pending | in_progress | completed | failed | cancelled
    conversation_id?: string;
    created_at_unix?: number;
    updated_at_unix?: number;
}

export interface BatchCallDetails {
    id: string;
    name?: string;
    agent_id?: string;
    phone_number_id?: string;
    status: string; // pending | in_progress | completed | failed | cancelled
    total_calls_dispatched?: number;
    total_calls_scheduled?: number;
    created_at_unix?: number;
    last_updated_at_unix?: number;
    recipients?: BatchRecipient[];
}

/**
 * Fetches live status/details for a batch call submission.
 */
export const getBatchCall = async (batchId: string): Promise<BatchCallDetails> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/batch-calling/${batchId}`, {
        method: "GET",
        headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch detail error: ${response.status} - ${errorText}`);
    }

    return await response.json();
};

/**
 * Cancels an in-progress batch call.
 */
export const cancelBatchCall = async (batchId: string): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/batch-calling/${batchId}/cancel`, {
        method: "POST",
        headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Batch cancel error: ${response.status} - ${errorText}`);
    }
};

/**
 * Aggregates batch recipient statuses into stats.
 */
export interface BatchAggregateStats {
    total: number;
    called: number;      // not pending
    answered: number;    // completed
    failed: number;      // failed
    inProgress: number;
    pending: number;
    progress: number;    // %
}

export const aggregateBatchStats = (batch: BatchCallDetails): BatchAggregateStats => {
    const rs = batch.recipients || [];
    const total = rs.length || batch.total_calls_scheduled || 0;
    let answered = 0, failed = 0, inProgress = 0, pending = 0;
    rs.forEach(r => {
        switch ((r.status || "").toLowerCase()) {
            case "completed": answered += 1; break;
            case "failed": case "cancelled": case "error": failed += 1; break;
            case "in_progress": case "dialing": case "ringing": inProgress += 1; break;
            case "pending": case "queued": default: pending += 1; break;
        }
    });
    const called = answered + failed + inProgress;
    return {
        total,
        called,
        answered,
        failed,
        inProgress,
        pending,
        progress: total > 0 ? Math.round((called / total) * 100) : 0,
    };
};

/**
 * Fetches the raw audio for the conversation and returns a blob URL.
 */
export const getConversationAudio = async (conversationId: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/conversations/${conversationId}/audio`, {
        method: "GET",
        headers: {
            "xi-api-key": apiKey
        }
    });

    if (!response.ok) {
        throw new Error("Ses kaydı alınamadı.");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Outbound — single ad-hoc call                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface OutboundCallOptions {
    /** Optional dynamic variables for first_message / prompt placeholders. */
    dynamicVariables?: Record<string, string | number | boolean>;
    /** Optional per-call overrides (first_message / prompt). */
    overrides?: {
        firstMessage?: string;
        prompt?: string;
    };
}

export interface OutboundCallResult {
    success: boolean;
    message?: string;
    conversation_id?: string;
    callSid?: string;
    [key: string]: any;
}

/**
 * Initiates a single outbound call via ElevenLabs' Twilio integration.
 * The agent's linked phone number places the call to `toNumber`.
 */
export const makeOutboundCall = async (
    agentId: string,
    phoneNumberId: string,
    toNumber: string,
    options: OutboundCallOptions = {},
    apiKeyOverride?: string,
): Promise<OutboundCallResult> => {
    const apiKey = apiKeyOverride || getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const body: any = {
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: toNumber,
    };

    if (options.dynamicVariables || options.overrides) {
        body.conversation_initiation_client_data = {};
        if (options.dynamicVariables) {
            body.conversation_initiation_client_data.dynamic_variables = options.dynamicVariables;
        }
        if (options.overrides) {
            const override: any = { agent: { prompt: {} } };
            if (options.overrides.firstMessage) override.agent.first_message = options.overrides.firstMessage;
            if (options.overrides.prompt) override.agent.prompt.prompt = options.overrides.prompt;
            body.conversation_initiation_client_data.conversation_config_override = override;
        }
    }

    // SIP trunk (Zadarma) ve ElevenLabs native numaralar için doğru endpoint
    const response = await fetch(`${API_BASE}/v1/convai/sip-trunk/outbound-call`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const detail = data?.detail;
        const errText = typeof detail === "string"
            ? detail
            : detail?.message || data?.message || JSON.stringify(data);
        throw new Error(`Arama başlatılamadı: ${response.status} — ${errText}`);
    }

    return {
        success: true,
        ...data,
    };
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Knowledge Base (RAG) — workspace-scoped documents usable by any agent.      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface KnowledgeBaseDocument {
    id: string;
    name: string;
    type: KnowledgeBaseDocType;
    /** ISO or unix-secs depending on ElevenLabs response */
    created_at_unix_secs?: number;
    size_bytes?: number;
    [key: string]: any;
}

/**
 * Lists all knowledge base documents in the workspace.
 */
export const listKnowledgeBase = async (): Promise<KnowledgeBaseDocument[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/knowledge-base`, {
        method: "GET",
        headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const list: any[] = data.documents || data.knowledge_base || data || [];
    return list.map((d: any) => ({
        id: d.id,
        name: d.name || d.id,
        type: (d.type as KnowledgeBaseDocType) || "file",
        created_at_unix_secs: d.created_at_unix_secs,
        size_bytes: d.size_bytes,
    }));
};

/**
 * Uploads a file (PDF, TXT, DOCX, HTML, etc.) to the knowledge base.
 */
export const uploadKnowledgeBaseFile = async (
    file: File,
    name?: string
): Promise<KnowledgeBaseDocument> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);

    const response = await fetch(`${API_BASE}/v1/convai/knowledge-base/file`, {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dosya yüklenemedi: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
        id: data.id,
        name: data.name || name || file.name,
        type: "file",
    };
};

/**
 * Ingests a web URL into the knowledge base (ElevenLabs crawls the page).
 */
export const uploadKnowledgeBaseUrl = async (
    url: string,
    name?: string
): Promise<KnowledgeBaseDocument> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/knowledge-base/url`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, name: name || url }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`URL eklenemedi: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
        id: data.id,
        name: data.name || name || url,
        type: "url",
    };
};

/**
 * Adds raw text as a knowledge base document.
 */
export const uploadKnowledgeBaseText = async (
    text: string,
    name: string
): Promise<KnowledgeBaseDocument> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/knowledge-base/text`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, name }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Metin eklenemedi: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
        id: data.id,
        name: data.name || name,
        type: "text",
    };
};

/**
 * Deletes a document from the workspace knowledge base.
 * Note: also detaches it from any agents that reference it.
 */
export const deleteKnowledgeBase = async (documentId: string): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    const response = await fetch(`${API_BASE}/v1/convai/knowledge-base/${documentId}`, {
        method: "DELETE",
        headers: { "xi-api-key": apiKey },
    });

    if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(`Silme başarısız: ${response.status} - ${errorText}`);
    }
};

