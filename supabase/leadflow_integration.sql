-- ============================================================
-- LeadFlow → CallFlow Integration Schema
-- Supabase SQL Editor'da çalıştır
-- ============================================================

-- 1. LeadFlow API key'lerini tutan tablo
CREATE TABLE IF NOT EXISTS leadflow_connections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  api_key         TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  name            TEXT        NOT NULL DEFAULT 'LeadFlow Integration',
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_used_at    TIMESTAMPTZ
);

-- 2. contacts tablosuna LeadFlow tracking kolonları ekle
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source         TEXT DEFAULT 'manual';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS leadflow_id    TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags           TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT now();

-- 3. Index'ler
CREATE INDEX IF NOT EXISTS idx_contacts_org_source
  ON contacts (organization_id, source);

CREATE INDEX IF NOT EXISTS idx_contacts_org_created
  ON contacts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leadflow_connections_key
  ON leadflow_connections (api_key) WHERE active = true;

-- 4. Şimdilik tek org için: organizations tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  NOT NULL,
  slug       TEXT  UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Varsayılan org ekle (zaten varsa hata vermez)
INSERT INTO organizations (name, slug)
VALUES ('Lueratech Internal', 'lueratech')
ON CONFLICT (slug) DO NOTHING;
