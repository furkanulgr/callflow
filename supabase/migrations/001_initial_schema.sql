-- ============================================================
-- CallFlow - Initial Database Schema
-- Multi-tenant SaaS Architecture with Supabase RLS
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ──────────────────────────────────────────────────────────
-- 1. ORGANIZATIONS (Tenants)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 2. ORGANIZATION MEMBERS (User ↔ Org many-to-many)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by      UUID REFERENCES auth.users(id),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- 3. AI AGENTS (ElevenLabs agent configs per organization)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  elevenlabs_agent_id TEXT NOT NULL,          -- ElevenLabs'daki agent ID
  elevenlabs_api_key  TEXT,                   -- Org bazlı API key (opsiyonel override)
  voice_id            TEXT,
  system_prompt       TEXT,
  first_message       TEXT,
  language            TEXT NOT NULL DEFAULT 'tr',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 4. PHONE NUMBERS (Twilio numbers assigned per org)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_numbers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number          TEXT NOT NULL UNIQUE,       -- E.164 format: +901234567890
  friendly_name   TEXT,
  twilio_sid      TEXT,                       -- Twilio PhoneNumber SID
  country_code    TEXT NOT NULL DEFAULT 'TR',
  capabilities    JSONB NOT NULL DEFAULT '{"voice": true, "sms": false}',
  assigned_agent_id UUID REFERENCES agents(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 5. CONTACTS (Phone numbers to call)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,              -- E.164 format
  email           TEXT,
  company         TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  custom_data     JSONB NOT NULL DEFAULT '{}',
  do_not_call     BOOLEAN NOT NULL DEFAULT FALSE,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, phone)
);

-- ──────────────────────────────────────────────────────────
-- 6. CAMPAIGNS (Outbound call campaigns)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  agent_id              UUID NOT NULL REFERENCES agents(id),
  from_number_id        UUID REFERENCES phone_numbers(id),
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),

  -- Zamanlama
  scheduled_at          TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  -- Arama saatleri (örn: 09:00-18:00)
  call_window_start     TIME NOT NULL DEFAULT '09:00:00',
  call_window_end       TIME NOT NULL DEFAULT '18:00:00',
  call_days             INT[] NOT NULL DEFAULT '{1,2,3,4,5}',  -- 0=Pazar, 1=Pzt
  timezone              TEXT NOT NULL DEFAULT 'Europe/Istanbul',

  -- Yeniden deneme
  max_retries           INT NOT NULL DEFAULT 2,
  retry_delay_minutes   INT NOT NULL DEFAULT 30,

  -- İstatistikler (denormalize, hız için)
  total_contacts        INT NOT NULL DEFAULT 0,
  calls_completed       INT NOT NULL DEFAULT 0,
  calls_answered        INT NOT NULL DEFAULT 0,
  calls_failed          INT NOT NULL DEFAULT 0,

  -- Webhook post-call
  webhook_url           TEXT,
  webhook_headers       JSONB,

  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 7. CAMPAIGN CONTACTS (Campaign ↔ Contact many-to-many)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id        UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'calling', 'answered', 'no_answer', 'busy', 'failed', 'completed', 'skipped')),
  attempts          INT NOT NULL DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  next_attempt_at   TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  UNIQUE(campaign_id, contact_id)
);

-- ──────────────────────────────────────────────────────────
-- 8. CALLS (Individual call records)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id           UUID REFERENCES campaigns(id),
  campaign_contact_id   UUID REFERENCES campaign_contacts(id),
  agent_id              UUID NOT NULL REFERENCES agents(id),
  contact_id            UUID REFERENCES contacts(id),

  -- Telefon bilgileri
  from_number           TEXT NOT NULL,
  to_number             TEXT NOT NULL,
  twilio_call_sid       TEXT UNIQUE,           -- Twilio'nun verdiği SID
  elevenlabs_conv_id    TEXT,                  -- ElevenLabs conversation ID

  -- Durum
  direction             TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  status                TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'ringing', 'answered', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'cancelled')),

  -- Zamanlama
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at           TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  duration_seconds      INT,

  -- İçerik
  transcript            JSONB,                -- [{role: 'agent'|'user', text: '...', timestamp: '...'}]
  summary               TEXT,                 -- AI tarafından oluşturulan özet
  sentiment             TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  outcome               TEXT,                 -- 'appointment_set', 'not_interested', 'callback_requested', vb.

  -- Teknik
  recording_url         TEXT,
  error_message         TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 9. CALL EVENTS (Real-time events during calls)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id     UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- 'transcript', 'agent_audio', 'user_audio', 'interruption', 'error'
  payload     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- 10. WEBHOOK LOGS (Post-call webhook attempts)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id         UUID REFERENCES calls(id),
  campaign_id     UUID REFERENCES campaigns(id),
  url             TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'POST',
  request_body    JSONB,
  response_status INT,
  response_body   TEXT,
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_count   INT NOT NULL DEFAULT 1,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES (Performans için)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_elevenlabs_id ON agents(elevenlabs_agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_calls_org ON calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_sid ON calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_initiated_at ON calls(initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_call ON call_events(call_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_agents
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_contacts
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_calls
  BEFORE UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (Multi-tenant isolation)
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: kullanıcının hangi org'lara üye olduğunu döner
CREATE OR REPLACE FUNCTION get_user_org_ids(user_uuid UUID)
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(organization_id)
  FROM organization_members
  WHERE user_id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Organizations: sadece üyesi olduğun orglara erişim
CREATE POLICY "org_members_can_view_their_orgs" ON organizations
  FOR SELECT USING (
    id = ANY(get_user_org_ids(auth.uid()))
  );

-- Organization Members: kendi org üyelerini görebilirsin
CREATE POLICY "members_can_view_org_members" ON organization_members
  FOR SELECT USING (
    organization_id = ANY(get_user_org_ids(auth.uid()))
  );

-- Agents: sadece kendi org'undaki agentlara erişim
CREATE POLICY "org_agents_select" ON agents
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_agents_insert" ON agents
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_agents_update" ON agents
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_agents_delete" ON agents
  FOR DELETE USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- Phone Numbers
CREATE POLICY "org_phones_select" ON phone_numbers
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_phones_insert" ON phone_numbers
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_phones_update" ON phone_numbers
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- Contacts
CREATE POLICY "org_contacts_select" ON contacts
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_contacts_insert" ON contacts
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_contacts_update" ON contacts
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_contacts_delete" ON contacts
  FOR DELETE USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- Campaigns
CREATE POLICY "org_campaigns_select" ON campaigns
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_campaigns_insert" ON campaigns
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_campaigns_update" ON campaigns
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_campaigns_delete" ON campaigns
  FOR DELETE USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- Campaign Contacts
CREATE POLICY "org_campaign_contacts_select" ON campaign_contacts
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE organization_id = ANY(get_user_org_ids(auth.uid()))
    )
  );
CREATE POLICY "org_campaign_contacts_insert" ON campaign_contacts
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE organization_id = ANY(get_user_org_ids(auth.uid()))
    )
  );
CREATE POLICY "org_campaign_contacts_update" ON campaign_contacts
  FOR UPDATE USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE organization_id = ANY(get_user_org_ids(auth.uid()))
    )
  );

-- Calls
CREATE POLICY "org_calls_select" ON calls
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_calls_insert" ON calls
  FOR INSERT WITH CHECK (organization_id = ANY(get_user_org_ids(auth.uid())));
CREATE POLICY "org_calls_update" ON calls
  FOR UPDATE USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- Call Events
CREATE POLICY "org_call_events_select" ON call_events
  FOR SELECT USING (
    call_id IN (
      SELECT id FROM calls
      WHERE organization_id = ANY(get_user_org_ids(auth.uid()))
    )
  );

-- Webhook Logs
CREATE POLICY "org_webhook_logs_select" ON webhook_logs
  FOR SELECT USING (organization_id = ANY(get_user_org_ids(auth.uid())));

-- ============================================================
-- SERVICE ROLE BYPASS (Bridge server için)
-- Supabase service_role key tüm RLS'yi bypass eder - server tarafında kullanılır
-- ============================================================
