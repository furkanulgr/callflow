/**
 * CallFlow Frontend API Client
 * Bridge server'a istek atan tüm fonksiyonlar burada.
 */

import { getCurrentSession } from './supabase';

const BRIDGE_URL = import.meta.env['VITE_BRIDGE_SERVER_URL'] as string ?? 'http://localhost:3001';

// ─── Base fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getCurrentSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error ?? `API hatası: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface OutboundCallPayload {
  toNumber:       string;
  agentId:        string;
  organizationId: string;
  campaignId?:    string;
  contactId?:     string;
  metadata?:      Record<string, string>;
}

export interface OutboundCallResponse {
  success:   boolean;
  callDbId:  string;
  twilioSid: string;
  status:    string;
  to:        string;
  from:      string;
}

export interface ActiveCallsResponse {
  count: number;
  calls: Array<{
    callSid:          string;
    callDbId:         string;
    elevenlabsConvId?: string;
    startedAt:        string;
    transcriptCount:  number;
  }>;
}

// ─── Call API ─────────────────────────────────────────────────────────────────
export const callApi = {
  /** Yeni bir outbound çağrı başlat */
  startOutbound: (payload: OutboundCallPayload) =>
    apiFetch<OutboundCallResponse>('/api/calls/outbound', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),

  /** Aktif çağrıları listele */
  getActiveCalls: () =>
    apiFetch<ActiveCallsResponse>('/api/calls/active'),

  /** Çağrıyı kapat */
  hangup: (callSid: string) =>
    apiFetch<{ success: boolean }>(`/api/calls/${callSid}/hangup`, {
      method: 'POST',
    }),

  /** Kampanyadan bir sonraki kişiyi çağır */
  triggerNextCampaignCall: (campaignId: string, organizationId: string) =>
    apiFetch<{ success: boolean; callDbId?: string }>('/api/calls/campaign/next', {
      method: 'POST',
      body:   JSON.stringify({ campaignId, organizationId }),
    }),

  /** Bridge server sağlık kontrolü */
  healthCheck: () =>
    apiFetch<{ status: string; timestamp: string }>('/health'),
};

// ─── Supabase Data API ────────────────────────────────────────────────────────
export { supabase } from './supabase';
