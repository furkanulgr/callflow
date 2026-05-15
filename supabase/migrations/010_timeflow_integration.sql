-- Migration 010: TimeFlow entegrasyon key yönetimi
--
-- timeflow_connections: CallFlow'un TimeFlow için ürettiği keyler
-- organization_settings'e timeflow_api_key sütunu ekleme

CREATE TABLE IF NOT EXISTS timeflow_connections (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL DEFAULT 'TimeFlow Integration',
    api_key      TEXT        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_timeflow_connections_user
    ON timeflow_connections(user_id, active);

ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS timeflow_api_key TEXT;

ALTER TABLE timeflow_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own timeflow keys" ON timeflow_connections
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
