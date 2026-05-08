/**
 * WhatsApp Routes — Twilio WhatsApp Business API
 *
 * POST /api/whatsapp/send   — Tek numara / şablon mesajı gönder
 * POST /api/whatsapp/batch  — Toplu gönder
 * GET  /api/whatsapp/status — Twilio WhatsApp bağlantı durumunu kontrol et
 */

import { Router, Request, Response } from 'express';
import Twilio from 'twilio';
import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

export const whatsappRouter = Router();

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

// Twilio client — lazy init (TWILIO_WHATSAPP_NUMBER olmasa bile server başlar)
function getTwilioClient(): Twilio.Twilio {
  const { accountSid, authToken } = config.twilio;
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID veya TWILIO_AUTH_TOKEN tanımlı değil');
  }
  return Twilio(accountSid, authToken);
}

function getWhatsAppFrom(): string {
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) throw new Error('TWILIO_WHATSAPP_NUMBER tanımlı değil');
  // E.164 formatındaysa whatsapp: prefix ekle
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}

// ─── POST /api/whatsapp/send ─────────────────────────────────────────────────
whatsappRouter.post('/send', async (req: Request, res: Response): Promise<void> => {
  const { to, message, templateVars } = req.body as {
    to:             string;
    message:        string;
    templateVars?:  Record<string, string>;
  };

  if (!to || !message) {
    res.status(400).json({ error: '`to` ve `message` zorunludur' });
    return;
  }

  try {
    const client = getTwilioClient();
    const from   = getWhatsAppFrom();

    // Şablon değişkenlerini uygula: {{1}} → value1, {{name}} → John vb.
    let body = message;
    if (templateVars) {
      Object.entries(templateVars).forEach(([key, val]) => {
        body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      });
    }

    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const msg = await client.messages.create({
      from,
      to: toNumber,
      body,
    });

    console.log(`[WhatsApp] Gönderildi | to: ${to} | sid: ${msg.sid}`);
    res.json({ success: true, sid: msg.sid, status: msg.status });
  } catch (err: any) {
    Sentry.captureException(err);
    console.error('[WhatsApp] Gönderim hatası:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/whatsapp/batch ────────────────────────────────────────────────
// Birden fazla numaraya aynı mesajı (değişken desteği ile) gönder
whatsappRouter.post('/batch', async (req: Request, res: Response): Promise<void> => {
  const { numbers, message } = req.body as {
    numbers: string[];
    message: string;
  };

  if (!Array.isArray(numbers) || numbers.length === 0 || !message) {
    res.status(400).json({ error: '`numbers` (array) ve `message` zorunludur' });
    return;
  }

  if (numbers.length > 100) {
    res.status(400).json({ error: 'Tek seferde maksimum 100 numara' });
    return;
  }

  try {
    const client = getTwilioClient();
    const from   = getWhatsAppFrom();

    const results = await Promise.allSettled(
      numbers.map(to => {
        const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
        return client.messages.create({ from, to: toNumber, body: message });
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.length - succeeded;

    console.log(`[WhatsApp] Toplu gönderim | toplam: ${numbers.length} | başarılı: ${succeeded} | başarısız: ${failed}`);
    res.json({ success: true, total: numbers.length, succeeded, failed });
  } catch (err: any) {
    Sentry.captureException(err);
    console.error('[WhatsApp] Toplu gönderim hatası:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/whatsapp/status ─────────────────────────────────────────────────
// Twilio hesabının WhatsApp için yapılandırılmış olup olmadığını kontrol et
whatsappRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!whatsappNumber || !config.twilio.accountSid || !config.twilio.authToken) {
    res.json({
      connected:    false,
      reason:       'TWILIO_WHATSAPP_NUMBER, TWILIO_ACCOUNT_SID veya TWILIO_AUTH_TOKEN eksik',
      phoneNumber:  null,
    });
    return;
  }

  try {
    const client = getTwilioClient();
    const from   = whatsappNumber.startsWith('whatsapp:')
      ? whatsappNumber.slice('whatsapp:'.length)
      : whatsappNumber;

    // Twilio'da bu numaranın var olup olmadığını kontrol et
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: from, limit: 1 });

    res.json({
      connected:   numbers.length > 0,
      phoneNumber: from,
      reason:      numbers.length === 0 ? 'Numara Twilio hesabında bulunamadı' : null,
    });
  } catch (err: any) {
    Sentry.captureException(err);
    res.json({
      connected:   false,
      reason:      'Twilio bağlantı hatası',
      phoneNumber: whatsappNumber,
    });
  }
});

// ─── POST /api/whatsapp/send-after-call ──────────────────────────────────────
// ElevenLabs webhook'undan çağrılır — arama sonrası otomatik WhatsApp mesajı
// (dahili kullanım; requireAuth ile koruNMAZ ama sadece server içinden çağrılır)
export async function sendWhatsAppAfterCall(params: {
  userId:         string;
  toPhone:        string;
  conversationId: string;
  agentId:        string;
  callSuccessful: string;
}): Promise<void> {
  const { userId, toPhone, conversationId, agentId, callSuccessful } = params;

  // Aktif şablonu bul — trigger_type = 'after_call'
  const { data: templates, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_type', 'after_call')
    .eq('is_active', true)
    .limit(1);

  if (error || !templates?.length) {
    // Şablon yoksa sessizce çık
    return;
  }

  const template = templates[0];

  try {
    const client = getTwilioClient();
    const from   = getWhatsAppFrom();

    const toNumber = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
    const body = template.message
      .replace(/\{\{conversation_id\}\}/g, conversationId)
      .replace(/\{\{status\}\}/g, callSuccessful === 'success' ? 'başarılı' : 'tamamlandı');

    const msg = await client.messages.create({ from, to: toNumber, body });
    console.log(`[WhatsApp] Arama sonrası otomatik mesaj | to: ${toPhone} | sid: ${msg.sid}`);
  } catch (err) {
    // Kritik değil — loglayıp geç
    console.error('[WhatsApp] Otomatik mesaj gönderilemedi:', err);
  }
}
