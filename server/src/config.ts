import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  serverUrl: process.env['SERVER_URL'] ?? 'http://localhost:3001',

  twilio: {
    accountSid: requireEnv('TWILIO_ACCOUNT_SID'),
    authToken: requireEnv('TWILIO_AUTH_TOKEN'),
    phoneNumber: requireEnv('TWILIO_PHONE_NUMBER'),
  },

  elevenlabs: {
    apiKey: requireEnv('ELEVENLABS_API_KEY'),
    wsUrl: 'wss://api.elevenlabs.io/v1/convai/conversation',
  },

  supabase: {
    url: requireEnv('SUPABASE_URL'),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },

  n8n: {
    webhookUrl: process.env['N8N_WEBHOOK_URL'] ?? null,
  },
} as const;
