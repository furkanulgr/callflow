# CallFlow — AI Destekli İşletme Asistanı

> **Her işletme için tam donanımlı yapay zeka sekreter.** Outbound arama kampanyaları, gelen arama yönetimi, randevu takibi ve WhatsApp otomasyonu — tek platformda.

[![CI](https://github.com/your-org/callflow/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/callflow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## İçindekiler

- [Ne Yapar?](#ne-yapar)
- [Teknoloji Stack](#teknoloji-stack)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Supabase Migrations](#supabase-migrations)
- [Deployment (Railway)](#deployment-railway)
- [Deployment (Docker)](#deployment-docker)
- [API Referansı](#api-referansı)
- [Mimari](#mimari)

---

## Ne Yapar?

CallFlow, bir insan sekreterin %95'ini yapay zeka ile otomatize eder:

| Özellik | Açıklama |
|---------|----------|
| 📞 **Outbound Arama** | ElevenLabs AI + Twilio ile müşterileri otomatik ara |
| 📥 **Gelen Arama** | Twilio, ElevenLabs Native, SIP veya özel webhook üzerinden gelen çağrıları AI asistana yönlendir |
| 🤖 **Çok Asistan** | Her kampanya/kanal için farklı AI asistan karakteri oluştur |
| 📅 **Randevu Takibi** | Arama sırasında alınan randevuları takvime işle |
| 💬 **WhatsApp** | Arama sonrası otomatik WhatsApp mesajı gönder (Twilio Business API) |
| 📊 **Analitik** | Kampanya istatistikleri, yanıt oranları, konuşma analizleri |
| 🏢 **Multi-tenant** | Row-Level Security ile her kullanıcı yalnızca kendi verisini görür |
| 🧙 **Onboarding** | İlk giriş yapan kullanıcı için sektöre özel hazır AI asistan şablonu |

---

## Teknoloji Stack

```
Frontend          React 18 + TypeScript + Vite + Tailwind CSS
Backend           Express + TypeScript (Node.js 20)
Veritabanı        Supabase (PostgreSQL + RLS + Auth)
AI Ses            ElevenLabs Conversational AI
Telefoni          Twilio (Outbound + Inbound + WhatsApp)
Hata Takibi       Sentry (opsiyonel)
CI/CD             GitHub Actions
Deployment        Railway (server) + Vercel/Netlify (frontend)
```

---

## Hızlı Başlangıç

### Gereksinimler

- Node.js 20+
- Supabase projesi
- ElevenLabs hesabı (Conversational AI erişimi)
- Twilio hesabı + telefon numarası

### 1. Repoyu klonla

```bash
git clone https://github.com/your-org/callflow.git
cd callflow
```

### 2. Frontend bağımlılıkları

```bash
npm install
cp .env.example .env.local   # Değişkenleri doldur
```

### 3. Server bağımlılıkları

```bash
cd server
npm install
cp .env.example .env         # Değişkenleri doldur
cd ..
```

### 4. Supabase migrations

```bash
# Supabase CLI yüklü değilse: npm install -g supabase
supabase db push
# veya sırayla:
# psql $SUPABASE_DB_URL -f supabase/migrations/001_initial.sql
# ...
# psql $SUPABASE_DB_URL -f supabase/migrations/007_business_profile.sql
```

### 5. Geliştirme modunda çalıştır

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Server
cd server && npm run dev
```

Frontend: http://localhost:5173  
Server:   http://localhost:3001

---

## Ortam Değişkenleri

### Frontend (`.env.local`)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ELEVENLABS_API_KEY=sk_...
VITE_BRIDGE_SERVER_URL=https://your-callflow-server.railway.app
```

### Server (`server/.env`)

```env
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+901234567890
TWILIO_WHATSAPP_NUMBER=+14155238886   # WhatsApp Business numarası

# ElevenLabs
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_WEBHOOK_SECRET=wsec_xxxxxxxxxx   # ElevenLabs dashboard > Webhooks

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Server
NODE_ENV=production
PORT=3001
SERVER_URL=https://your-server.railway.app

# CORS — frontend domain(ları)
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Opsiyonel
SENTRY_DSN=https://...@sentry.io/...
N8N_BASE_URL=https://your-n8n.example.com
N8N_WEBHOOK_URL=https://your-n8n.example.com/webhook/callflow
```

---

## Supabase Migrations

`supabase/migrations/` klasöründe sıralı migration dosyaları bulunur:

| Dosya | İçerik |
|-------|--------|
| `001_initial.sql` | Temel tablolar (agents, campaigns, calls, conversations) |
| `002_...` | İlk RLS politikaları |
| `003_...` | Kampanya campaign_calls tablosu |
| `004_...` | Trigger ve fonksiyonlar |
| `005_appointments_whatsapp.sql` | Randevular, WhatsApp şablonları, organizasyon ayarları |
| `006_inbound_connections.sql` | Gelen arama bağlantıları (provider-agnostic) |
| `007_business_profile.sql` | Onboarding alanları (business_type, services, working_hours) |

Hepsini sırayla uygulamak için:

```bash
for f in supabase/migrations/*.sql; do
  psql "$SUPABASE_DB_URL" -f "$f"
done
```

---

## Deployment (Railway)

### Server

1. [Railway](https://railway.app) → New Project → Deploy from GitHub
2. Root dizini olarak `server/` klasörünü seç
3. Environment variables'ı ekle (yukarıdaki `server/.env` tablosundan)
4. Railway otomatik HTTPS URL atar → `SERVER_URL` olarak kaydet
5. Twilio konsolunda gelen arama webhook URL'ini ayarla:  
   `https://your-server.railway.app/twiml/inbound`
6. ElevenLabs konsolunda post-call webhook URL'ini ayarla:  
   `https://your-server.railway.app/webhooks/elevenlabs`

### Frontend (Vercel)

1. Vercel → Import Git Repository
2. Framework: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables: `VITE_*` değişkenlerini ekle

---

## Deployment (Docker)

```bash
# .env dosyasını oluştur (server/.env.example'dan kopyala ve doldur)
cp server/.env.example .env

# Build ve çalıştır
docker compose up -d

# Logları izle
docker compose logs -f server

# Durumu kontrol et
curl http://localhost:3001/health
```

---

## API Referansı

Tüm `/api/*` endpoint'leri `Authorization: Bearer <supabase_jwt>` header'ı gerektirir.

### Çağrılar

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/calls/outbound` | Tek outbound çağrı başlat |
| POST | `/api/calls/batch` | Toplu outbound çağrı |
| GET | `/api/calls/active` | Aktif çağrıları listele |
| GET | `/api/calls/phone-numbers` | Twilio telefon numaralarını listele |

### Gelen Arama Bağlantıları

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/inbound/connections` | Bağlantıları listele |
| POST | `/api/inbound/connections` | Yeni bağlantı oluştur |
| PUT | `/api/inbound/connections/:id` | Bağlantı güncelle |
| DELETE | `/api/inbound/connections/:id` | Bağlantı sil |
| POST | `/api/inbound/connections/:id/test` | Bağlantıyı test et |
| GET | `/api/inbound/webhook-url` | Webhook URL'ini getir |

### WhatsApp

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/whatsapp/send` | Tek mesaj gönder |
| POST | `/api/whatsapp/batch` | Toplu mesaj gönder (maks 100) |
| GET | `/api/whatsapp/status` | Twilio bağlantı durumu |

### Webhooks (Auth gerektirmez — kendi imzası var)

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/webhooks/elevenlabs` | ElevenLabs post-call webhook |
| POST | `/twiml/outbound` | Twilio outbound TwiML |
| POST | `/twiml/inbound` | Twilio inbound TwiML |
| POST | `/twiml/status` | Twilio call status callback |

### Sistem

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/health` | Server + DB sağlık kontrolü |

---

## Mimari

```
┌─────────────────────────────────────────────────────────┐
│  Kullanıcı (Browser)                                    │
│  React + Vite (Vercel)                                  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CallFlow Server (Railway)                              │
│  Express + TypeScript                                   │
│                                                         │
│  /api/calls/*     → Outbound çağrı yönetimi             │
│  /api/inbound/*   → Gelen arama bağlantıları            │
│  /api/whatsapp/*  → WhatsApp Twilio API                 │
│  /webhooks/*      → ElevenLabs post-call events         │
│  /twiml/*         → Twilio webhook handler              │
└──────┬────────────┬────────────────────┬────────────────┘
       │            │                    │
       ▼            ▼                    ▼
  Twilio API   ElevenLabs AI       Supabase
  (Outbound    (Conversational     (PostgreSQL + RLS)
   Inbound      AI API)
   WhatsApp)
```

### Gelen Arama Akışı (Twilio)

```
Müşteri arar → Twilio → POST /twiml/inbound
  → DB'den agent lookup (inbound_connections tablosu)
  → TwiML <Connect><Stream> döndür
  → WebSocket /stream → ElevenLabs AI Agent
  → Konuşma biter → POST /twiml/status
  → POST /webhooks/elevenlabs (analiz + WhatsApp auto-trigger)
```

### Güvenlik

- Tüm `/api/*` endpoint'leri Supabase JWT ile korunur
- ElevenLabs webhook HMAC-SHA256 imzası doğrulanır
- Rate limiting: 60 req/dk (global), 20 req/dk (calls)
- Hata mesajları sızdırılmaz — tüm 500 yanıtları `"Internal server error"` döner
- Supabase Row-Level Security her tabloda aktif

---

## Lisans

[MIT](LICENSE) — LUERA Tech
