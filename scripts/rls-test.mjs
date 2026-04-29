/**
 * RLS Multi-Tenant İzolasyon Testi
 *
 * SETUP (bir kez yap):
 *   Supabase SQL Editor'da:
 *
 *   -- 1. Test user'larını manuel oluştur ve onayla
 *   -- (signUp ile oluşturduktan sonra şu SQL'i çalıştır)
 *
 * Kullanım:
 *   node scripts/rls-test.mjs
 *
 *   İlk çalıştırdığında user yoksa hata verir + SQL gösterir.
 *   SQL çalıştır → tekrar dene → çalışır.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY olmalı');
  process.exit(1);
}

// FIXED test user'lar — her seferinde aynı
const userA = { email: 'rls-test-a@local.test', password: 'TestRLS123!' };
const userB = { email: 'rls-test-b@local.test', password: 'TestRLS123!' };

const log = (...args) => console.log(...args);
const ok = (msg) => log(`  ✅ ${msg}`);
const fail = (msg) => log(`  ❌ ${msg}`);

async function ensureLoggedIn(client, creds, label) {
  // Önce signIn dene
  const { data: signIn } = await client.auth.signInWithPassword(creds);
  if (signIn?.session) {
    return signIn.session;
  }

  // signIn başarısız → signUp dene
  const { data: signUp, error: signUpErr } = await client.auth.signUp(creds);
  if (signUpErr && !signUpErr.message.includes('already')) {
    throw new Error(`${label} signUp: ${signUpErr.message}`);
  }

  // signUp session verdi mi?
  if (signUp?.session) {
    return signUp.session;
  }

  // Email confirmation bekliyor → kullanıcıya net mesaj
  log(`\n  ⚠️  ${label} email onayı bekliyor.`);
  log(`  Supabase SQL Editor'a yapıştır ve çalıştır:\n`);
  log(`  UPDATE auth.users SET email_confirmed_at = NOW()`);
  log(`  WHERE email IN ('${userA.email}', '${userB.email}');\n`);
  log(`  Sonra bu scripti tekrar çalıştır.`);
  process.exit(1);
}

async function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  RLS Multi-Tenant İzolasyon Testi');
  log('═══════════════════════════════════════════════════════════\n');

  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  log('1️⃣  Test kullanıcıları (signIn / signUp)...');
  await ensureLoggedIn(clientA, userA, 'User A');
  await ensureLoggedIn(clientB, userB, 'User B');

  const { data: { user: whoA } } = await clientA.auth.getUser();
  const { data: { user: whoB } } = await clientB.auth.getUser();
  if (!whoA?.id || !whoB?.id) {
    fail('Auth context yok — kullanıcı session\'ı oluşturulmadı');
    process.exit(1);
  }
  const userAId = whoA.id;
  const userBId = whoB.id;
  ok(`User A: ${userA.email} (${userAId})`);
  ok(`User B: ${userB.email} (${userBId})\n`);

  // ─── 2. User A ile veri yarat ──────────────────────────
  log('2️⃣  User A kendi verilerini oluşturuyor...');

  const { data: campA, error: campAErr } = await clientA
    .from('campaigns')
    .insert({
      name: 'User A Test Kampanyası',
      status: 'draft',
      total_contacts: 5,
      agent_id: 'test-agent-a',
      user_id: userAId,
    })
    .select().single();
  if (campAErr) fail(`Kampanya: ${campAErr.message}`);
  else ok(`Kampanya yarattı: ${campA.id}`);

  const { data: contactA, error: contactAErr } = await clientA
    .from('contacts')
    .insert({
      name: 'User A Contact', phone: '+905550000001',
      source: 'leadflow', user_id: userAId,
    })
    .select().single();
  if (contactAErr) fail(`Contact: ${contactAErr.message}`);
  else ok(`Contact yarattı: ${contactA.id}`);

  const { data: connA, error: connAErr } = await clientA
    .from('leadflow_connections')
    .insert({ user_id: userAId, name: 'User A Connection', active: true })
    .select().single();
  if (connAErr) fail(`Connection: ${connAErr.message}`);
  else ok(`Connection yarattı: ${connA.id} | api_key: ${connA.api_key?.substring(0, 8)}...\n`);

  // ─── 3. User B veriyi görüyor mu? ──────────────────────
  log('3️⃣  User B, A\'nın verilerini görmeye çalışıyor (GÖRMEMELİ!)...');

  const { data: campsB } = await clientB.from('campaigns').select('*');
  const aCampsVisible = (campsB || []).filter(c => c.user_id === userAId);
  if (aCampsVisible.length > 0) fail(`SIZINTI! ${aCampsVisible.length} kampanya görüyor`);
  else ok(`Kampanyalar GÖRÜNMÜYOR ✓`);

  const { data: contactsB } = await clientB.from('contacts').select('*');
  const aContactsVisible = (contactsB || []).filter(c => c.user_id === userAId);
  if (aContactsVisible.length > 0) fail(`SIZINTI! ${aContactsVisible.length} contact görüyor`);
  else ok(`Contact'lar GÖRÜNMÜYOR ✓`);

  const { data: connsB } = await clientB.from('leadflow_connections').select('*');
  const aConnsVisible = (connsB || []).filter(c => c.user_id === userAId);
  if (aConnsVisible.length > 0) fail(`SIZINTI! ${aConnsVisible.length} connection görüyor`);
  else ok(`Connection'lar GÖRÜNMÜYOR ✓\n`);

  // ─── 4. User B update yapamıyor mu? ────────────────────
  log('4️⃣  User B, A\'nın kampanyasını güncellemeye çalışıyor (BAŞARISIZ OLMALI!)...');
  if (campA) {
    const { data: upd } = await clientB
      .from('campaigns').update({ name: 'HACKED!' })
      .eq('id', campA.id).select();
    if (upd && upd.length > 0) fail(`SIZINTI! Güncelleyebildi`);
    else ok(`Güncelleyemiyor ✓`);
  }

  // ─── 5. User B silemiyor mu? ───────────────────────────
  log('\n5️⃣  User B, A\'nın contact\'ını silmeye çalışıyor (BAŞARISIZ OLMALI!)...');
  if (contactA) {
    const { count } = await clientB
      .from('contacts').delete({ count: 'exact' })
      .eq('id', contactA.id);
    if (count && count > 0) fail(`SIZINTI! Silebildi`);
    else ok(`Silemiyor ✓ (silinen: ${count ?? 0})`);
  }

  // ─── 6. User A kendi verisini görüyor mu? ──────────────
  log('\n6️⃣  User A kendi verilerini görüyor mu?...');
  const { data: campsA } = await clientA.from('campaigns').select('*');
  const ownCamps = (campsA || []).filter(c => c.user_id === userAId);
  if (ownCamps.length > 0) ok(`User A kendi kampanyalarını görüyor ✓ (${ownCamps.length} adet)`);
  else fail(`User A kendi kampanyalarını GÖREMİYOR! RLS ters kurulmuş.`);

  // ─── 7. Temizlik ──────────────────────────────────────
  log('\n7️⃣  Test verileri temizleniyor...');
  if (campA) await clientA.from('campaigns').delete().eq('id', campA.id);
  if (contactA) await clientA.from('contacts').delete().eq('id', contactA.id);
  if (connA) await clientA.from('leadflow_connections').delete().eq('id', connA.id);
  ok('Temizlendi');

  log('\n═══════════════════════════════════════════════════════════');
  log('  TEST BİTTİ — Yukarıda ❌ varsa RLS sızıntısı vardır');
  log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('💥 Hata:', err.message); process.exit(1); });
