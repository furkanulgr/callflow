const API_BASE = 'https://api.elevenlabs.io';

// The API key is usually kept in .env
const getApiKey = () => import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_9b658588d8c07ab7c1c6de853acd5109813203687a9de61c';

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

/**
 * Fetches the specific agent configuration via the ElevenLabs REST API.
 */
export const getAgentConfigData = async (agentId: string): Promise<{ prompt: string; firstMessage: string }> => {
    const apiKey = getApiKey();
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
    
    return { prompt, firstMessage };
};

/**
 * Updates the prompt and first_message portion of the agent via a PATCH request.
 */
export const updateAgentConfigData = async (agentId: string, newPrompt: string, newFirstMessage: string): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("VITE_ELEVENLABS_API_KEY is missing in .env");

    // Partial update payload for ElevenLabs System Prompt & First Message
    const payload = {
        conversation_config: {
            agent: {
                prompt: {
                    prompt: newPrompt
                },
                first_message: newFirstMessage
            }
        }
    };

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
    return data.phone_numbers || [];
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

