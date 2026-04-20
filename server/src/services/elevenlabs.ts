/**
 * ElevenLabs API Service
 *
 * Tüm ElevenLabs API çağrıları buradan yapılır.
 * Native Twilio entegrasyonu sayesinde WebSocket bridge'e gerek yok.
 */

import { config } from '../config';

const EL_BASE_URL = 'https://api.elevenlabs.io/v1';

// ─── Base fetch ───────────────────────────────────────────────────────────────
async function elFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const key = apiKey ?? config.elevenlabs.apiKey;

  const response = await fetch(`${EL_BASE_URL}${path}`, {
    ...options,
    headers: {
      'xi-api-key':   key,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs API hatası [${response.status}]: ${body}`);
  }

  return response.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface OutboundCallParams {
  agentId:             string;
  agentPhoneNumberId:  string;
  toNumber:            string;
  customVariables?:    Record<string, string>;
}

export interface BatchCallParams {
  agentId:             string;
  agentPhoneNumberId:  string;
  recipients:          Array<{ toNumber: string; customVariables?: Record<string, string> }>;
  scheduledAt?:        string;
}

export interface ElevenLabsPhoneNumber {
  phone_number_id: string;
  phone_number:    string;
  label?:          string;
  assigned_agent?: { agent_id: string; agent_name: string };
}

export interface ElevenLabsConversation {
  conversation_id: string;
  agent_id:        string;
  status:          string;
  start_time_unix_secs: number;
  call_duration_secs:   number;
  transcript?:     Array<{ role: string; message: string; time_in_call_secs: number }>;
  metadata?:       Record<string, unknown>;
}

// ─── ElevenLabs API ───────────────────────────────────────────────────────────
export const elevenlabsApi = {

  // ── Outbound tek çağrı ─────────────────────────────────────────────────────
  async makeOutboundCall(params: OutboundCallParams): Promise<{ conversationId: string }> {
    const data = await elFetch<{ conversation_id: string }>(
      `/convai/twilio/outbound-call`,
      {
        method: 'POST',
        body: JSON.stringify({
          agent_id:              params.agentId,
          agent_phone_number_id: params.agentPhoneNumberId,
          to_number:             params.toNumber,
          ...(params.customVariables && {
            conversation_config_override: {
              agent: { custom_llm_extra_body: params.customVariables },
            },
          }),
        }),
      }
    );

    return { conversationId: data.conversation_id };
  },

  // ── Batch çağrı (kampanya motoru) ─────────────────────────────────────────
  async makeBatchCall(params: BatchCallParams): Promise<{ batchId: string }> {
    const data = await elFetch<{ batch_id: string }>(
      `/convai/agents/${params.agentId}/phone-numbers/${params.agentPhoneNumberId}/batch-calls`,
      {
        method: 'POST',
        body: JSON.stringify({
          recipients: params.recipients.map((r) => ({
            phone_number:      r.toNumber,
            custom_variables:  r.customVariables ?? {},
          })),
          ...(params.scheduledAt && { scheduled_time: params.scheduledAt }),
        }),
      }
    );

    return { batchId: data.batch_id };
  },

  // ── Telefon numaralarını listele ───────────────────────────────────────────
  async getPhoneNumbers(): Promise<ElevenLabsPhoneNumber[]> {
    const data = await elFetch<{ phone_numbers: ElevenLabsPhoneNumber[] }>(
      '/convai/phone-numbers'
    );
    return data.phone_numbers ?? [];
  },

  // ── Conversation detayı (transcript dahil) ─────────────────────────────────
  async getConversation(conversationId: string): Promise<ElevenLabsConversation> {
    return elFetch<ElevenLabsConversation>(
      `/convai/conversations/${conversationId}`
    );
  },

  // ── Conversation'ı sonlandır ───────────────────────────────────────────────
  async endConversation(conversationId: string): Promise<void> {
    await elFetch<unknown>(
      `/convai/conversations/${conversationId}/end`,
      { method: 'POST' }
    );
  },

  // ── Agent listesi ──────────────────────────────────────────────────────────
  async getAgents(): Promise<Array<{ agent_id: string; name: string }>> {
    const data = await elFetch<{ agents: Array<{ agent_id: string; name: string }> }>(
      '/convai/agents'
    );
    return data.agents ?? [];
  },

  // ── Conversation geçmişi ───────────────────────────────────────────────────
  async getConversations(params?: {
    agentId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ conversations: ElevenLabsConversation[]; nextCursor?: string }> {
    const query = new URLSearchParams();
    if (params?.agentId) query.set('agent_id', params.agentId);
    if (params?.limit)   query.set('page_size', String(params.limit));
    if (params?.cursor)  query.set('cursor', params.cursor);

    const data = await elFetch<{
      conversations: ElevenLabsConversation[];
      next_cursor?: string;
    }>(`/convai/conversations?${query.toString()}`);

    return {
      conversations: data.conversations ?? [],
      nextCursor:    data.next_cursor,
    };
  },
};
