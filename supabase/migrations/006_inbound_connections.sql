-- Provider-agnostic inbound call routing
-- Hangi numara/URI hangi ElevenLabs agent'ına yönlendirilecek bilgisi

CREATE TABLE IF NOT EXISTS inbound_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_db_id      UUID REFERENCES agents(id) ON DELETE SET NULL,
  elevenlabs_agent_id TEXT NOT NULL,

  -- Provider: elevenlabs_native | twilio | sip | custom
  provider_type    TEXT NOT NULL DEFAULT 'elevenlabs_native'
                     CHECK (provider_type IN ('elevenlabs_native','twilio','sip','custom')),

  -- Gelen çağrının hedeflediği numara/URI (gösterim amaçlı)
  phone_number     TEXT,

  -- Provider'a özgü ayarlar (JSON blob)
  -- twilio:            { webhook_url_hint: "...", number_sid: "..." }
  -- sip:               { sip_uri: "..." }
  -- custom:            { webhook_url: "...", notes: "..." }
  -- elevenlabs_native: { elevenlabs_phone_number_id: "..." }
  config           JSONB NOT NULL DEFAULT '{}',

  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_tested_at   TIMESTAMPTZ,
  test_status      TEXT CHECK (test_status IN ('ok','error','pending')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbound_connections_user_id_idx  ON inbound_connections(user_id);
CREATE INDEX IF NOT EXISTS inbound_connections_phone_idx    ON inbound_connections(phone_number);
CREATE INDEX IF NOT EXISTS inbound_connections_provider_idx ON inbound_connections(provider_type);

ALTER TABLE inbound_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_inbound_connections" ON inbound_connections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_inbound_connections" ON inbound_connections
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP TRIGGER IF EXISTS inbound_connections_updated_at ON inbound_connections;
CREATE TRIGGER inbound_connections_updated_at
  BEFORE UPDATE ON inbound_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
