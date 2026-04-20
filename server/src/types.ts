// ─── Twilio Media Stream Messages ─────────────────────────────────────────────
export interface TwilioMediaStreamMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: { encoding: string; sampleRate: number; channels: number };
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string; // base64 mulaw audio
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

export interface TwilioSendMediaMessage {
  event: 'media';
  streamSid: string;
  media: { payload: string }; // base64 mulaw audio
}

export interface TwilioMarkMessage {
  event: 'mark';
  streamSid: string;
  mark: { name: string };
}

export interface TwilioClearMessage {
  event: 'clear';
  streamSid: string;
}

// ─── ElevenLabs ConvAI WebSocket Messages ─────────────────────────────────────
export interface ElevenLabsInitMessage {
  type: 'conversation_initiation_client_data';
  custom_llm_extra_body?: Record<string, unknown>;
  conversation_config_override?: {
    agent?: {
      prompt?: { prompt: string };
      first_message?: string;
      language?: string;
    };
    tts?: { voice_id?: string };
  };
}

export interface ElevenLabsUserAudioMessage {
  user_audio_chunk: string; // base64 PCM or mulaw audio
}

export type ElevenLabsIncomingMessage =
  | { type: 'conversation_initiation_metadata'; conversation_initiation_metadata_event: { conversation_id: string; agent_output_audio_format: string } }
  | { type: 'audio'; audio_event: { audio_base_64: string; event_id: number } }
  | { type: 'agent_response'; agent_response_event: { agent_response: string } }
  | { type: 'user_transcript'; user_transcription_event: { user_transcript: string } }
  | { type: 'interruption'; interruption_event: { event_id: number } }
  | { type: 'ping'; ping_event: { event_id: number; ping_ms?: number } }
  | { type: 'internal_tentative_agent_response'; tentative_agent_response_internal_event: { tentative_agent_response: string } }
  | { type: 'client_tool_call'; client_tool_call: { tool_call_id: string; tool_name: string; parameters: Record<string, unknown> } };

// ─── Bridge Session ────────────────────────────────────────────────────────────
export interface BridgeSession {
  callSid: string;
  streamSid: string;
  elevenlabsConvId?: string;
  callDbId?: string;
  agentId: string;
  organizationId: string;
  transcript: TranscriptEntry[];
  startedAt: Date;
}

export interface TranscriptEntry {
  role: 'agent' | 'user';
  text: string;
  timestamp: string;
}

// ─── Outbound Call Request ─────────────────────────────────────────────────────
export interface OutboundCallRequest {
  toNumber: string;          // E.164: +905551234567
  agentId: string;           // Kendi DB'mizdeki agent UUID
  campaignId?: string;
  contactId?: string;
  organizationId: string;
  metadata?: Record<string, string>;
}
