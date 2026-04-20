import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { TranscriptEntry } from '../types';

// Service role client - RLS bypass eder, sadece server tarafında kullanılır
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  { auth: { persistSession: false } }
);

// ─── Agent ────────────────────────────────────────────────────────────────────
export async function getAgentById(agentDbId: string) {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentDbId)
    .eq('is_active', true)
    .single();

  if (error) throw new Error(`Agent bulunamadı: ${error.message}`);
  return data;
}

// ─── Call ──────────────────────────────────────────────────────────────────────
export async function createCallRecord(params: {
  organizationId: string;
  agentId: string;
  fromNumber: string;
  toNumber: string;
  twilioCallSid: string;
  campaignId?: string;
  contactId?: string;
  campaignContactId?: string;
  direction?: 'inbound' | 'outbound';
}) {
  const { data, error } = await supabase
    .from('calls')
    .insert({
      organization_id:       params.organizationId,
      agent_id:              params.agentId,
      from_number:           params.fromNumber,
      to_number:             params.toNumber,
      twilio_call_sid:       params.twilioCallSid,
      campaign_id:           params.campaignId ?? null,
      contact_id:            params.contactId ?? null,
      campaign_contact_id:   params.campaignContactId ?? null,
      direction:             params.direction ?? 'outbound',
      status:                'initiated',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Call kaydı oluşturulamadı: ${error.message}`);
  return data.id as string;
}

export async function updateCallStatus(
  callDbId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from('calls')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', callDbId);

  if (error) console.error('[Supabase] updateCallStatus error:', error.message);
}

export async function updateCallAnswered(callDbId: string) {
  await updateCallStatus(callDbId, 'answered', {
    answered_at: new Date().toISOString(),
  });
}

export async function finalizeCall(callDbId: string, params: {
  status: string;
  durationSeconds?: number;
  transcript: TranscriptEntry[];
  elevenlabsConvId?: string;
}) {
  const { error } = await supabase
    .from('calls')
    .update({
      status:               params.status,
      ended_at:             new Date().toISOString(),
      duration_seconds:     params.durationSeconds ?? null,
      transcript:           params.transcript,
      elevenlabs_conv_id:   params.elevenlabsConvId ?? null,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', callDbId);

  if (error) console.error('[Supabase] finalizeCall error:', error.message);
}

// ─── Campaign Contact ──────────────────────────────────────────────────────────
export async function updateCampaignContactStatus(
  campaignContactId: string,
  status: string
) {
  await supabase
    .from('campaign_contacts')
    .update({ status, last_attempt_at: new Date().toISOString() })
    .eq('id', campaignContactId);
}

export async function getNextPendingContact(campaignId: string) {
  const { data } = await supabase
    .from('campaign_contacts')
    .select(`
      id,
      contact_id,
      attempts,
      contacts (id, name, phone, custom_data)
    `)
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return data;
}

// ─── Webhook Logging ───────────────────────────────────────────────────────────
export async function logWebhook(params: {
  organizationId: string;
  callId?: string;
  campaignId?: string;
  url: string;
  requestBody: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  success: boolean;
}) {
  await supabase.from('webhook_logs').insert({
    organization_id: params.organizationId,
    call_id:         params.callId ?? null,
    campaign_id:     params.campaignId ?? null,
    url:             params.url,
    request_body:    params.requestBody,
    response_status: params.responseStatus ?? null,
    response_body:   params.responseBody ?? null,
    success:         params.success,
  });
}
