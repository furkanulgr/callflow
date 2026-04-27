/**
 * Webhook Test Script
 *
 * ElevenLabs'tan gelmiş gibi sahte bir post-call payload gönderir.
 * HMAC signature doğru oluşturulduğu için Railway server kabul eder.
 *
 * Kullanım:
 *   node test-webhook.js <campaign-batch-id-or-agent-id>
 *
 * Örnek:
 *   node test-webhook.js agent_7301kpkv3tg1f22tvbfmg3qnqx6m
 */

import { createHmac } from 'crypto';

// ─── AYARLAR ─────────────────────────────────────────────────────────────────
const WEBHOOK_URL = 'https://callflow-production-3ce4.up.railway.app/webhooks/elevenlabs';
const WEBHOOK_SECRET = 'wsec_a290d1a198ee2be6bd20a3bc0401b525659ab980234d110f778a4cc575fd90d8';

// CLI'dan agent_id veya batch_id al (opsiyonel)
const targetId = process.argv[2] || 'agent_7301kpkv3tg1f22tvbfmg3qnqx6m';
const isBatchId = targetId.startsWith('batch') || targetId.length > 30 && !targetId.startsWith('agent');

// ─── SAHTE PAYLOAD ───────────────────────────────────────────────────────────
const payload = {
  type: 'post_call_webhook',
  event_timestamp: Math.floor(Date.now() / 1000),
  data: {
    conversation_id: `test_conv_${Date.now()}`,
    agent_id: isBatchId ? 'agent_7301kpkv3tg1f22tvbfmg3qnqx6m' : targetId,
    status: 'completed',
    call_duration_secs: 47,
    start_time_unix_secs: Math.floor(Date.now() / 1000) - 60,
    transcript: [
      { role: 'agent', message: 'Merhaba, nasılsınız?', time_in_call_secs: 1 },
      { role: 'user', message: 'İyiyim teşekkürler.', time_in_call_secs: 5 },
    ],
    analysis: {
      call_successful: 'success',
      evaluation_criteria_results: {},
      data_collection_results: {},
    },
    metadata: isBatchId ? { batch_id: targetId } : {},
    call: {
      to: '+905551234567',
      direction: 'outbound',
    },
  },
};

// ─── HMAC İMZALA ─────────────────────────────────────────────────────────────
const timestamp = Math.floor(Date.now() / 1000).toString();
const bodyString = JSON.stringify(payload);
const signedPayload = `${timestamp}.${bodyString}`;
const hash = createHmac('sha256', WEBHOOK_SECRET).update(signedPayload).digest('hex');
const signature = `t=${timestamp},v0=${hash}`;

console.log('🔧 Test webhook gönderiliyor...');
console.log(`   URL: ${WEBHOOK_URL}`);
console.log(`   Hedef: ${isBatchId ? 'batch_id' : 'agent_id'} = ${targetId}`);
console.log('');

// ─── İSTEK GÖNDER ────────────────────────────────────────────────────────────
const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'elevenlabs-signature': signature,
  },
  body: bodyString,
});

console.log(`📥 Status: ${response.status} ${response.statusText}`);
const text = await response.text();
if (text) console.log(`📥 Response: ${text}`);

console.log('');
if (response.ok) {
  console.log('✅ Webhook başarıyla gönderildi!');
  console.log('');
  console.log('Şimdi Railway logs\'a bak:');
  console.log('  → "[Webhook] ElevenLabs | type: post_call_webhook" satırı görünmeli');
  console.log('  → "[Webhook] ✅ Kampanya güncellendi" satırı görünmeli');
  console.log('');
  console.log('Supabase\'de kontrol et:');
  console.log('  SELECT id, name, called, answered FROM campaigns ORDER BY created_at DESC LIMIT 3;');
} else {
  console.log('❌ Webhook başarısız!');
  console.log('   401 → HMAC signature uyumsuzluğu (secret yanlış)');
  console.log('   500 → Server\'da hata, Railway logs\'a bak');
}
