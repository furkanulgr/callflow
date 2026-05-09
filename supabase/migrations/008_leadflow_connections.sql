-- ═══════════════════════════════════════════════════════════════
-- Migration 008 — LeadFlow Connections
-- LeadFlow ↔ CallFlow köprüsü için API key yönetimi
-- ═══════════════════════════════════════════════════════════════

-- ── Tablo ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadflow_connections (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key      TEXT        NOT NULL UNIQUE DEFAULT 'lf_' || encode(gen_random_bytes(32), 'hex'),
    name         TEXT        NOT NULL DEFAULT 'LeadFlow Integration',
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE leadflow_connections ENABLE ROW LEVEL SECURITY;

-- Her kullanıcı sadece kendi key'ini görür
CREATE POLICY "Users see own leadflow_connections"
    ON leadflow_connections FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT — sadece kendi user_id'si ile
CREATE POLICY "Users insert own leadflow_connections"
    ON leadflow_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE — sadece kendi kayıtlarını
CREATE POLICY "Users update own leadflow_connections"
    ON leadflow_connections FOR UPDATE
    USING (auth.uid() = user_id);

-- DELETE — sadece kendi kayıtlarını
CREATE POLICY "Users delete own leadflow_connections"
    ON leadflow_connections FOR DELETE
    USING (auth.uid() = user_id);

-- ── Service role — webhook doğrulama ─────────────────────────────
-- Server tarafı (service_role) api_key ile user lookup yapabilmeli
CREATE POLICY "Service role full access leadflow_connections"
    ON leadflow_connections FOR ALL
    USING (auth.role() = 'service_role');

-- ── İndeks ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leadflow_connections_api_key
    ON leadflow_connections (api_key)
    WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_leadflow_connections_user_id
    ON leadflow_connections (user_id);
