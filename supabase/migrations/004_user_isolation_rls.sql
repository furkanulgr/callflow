-- Multi-tenant izolasyonu için RLS politikaları
-- Her kullanıcı sadece kendi user_id'sine ait kayıtları görebilir/değiştirebilir

-- ─── campaigns tablosu ──────────────────────────────────────────────────────
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_campaigns" ON campaigns;
CREATE POLICY "users_view_own_campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_campaigns" ON campaigns;
CREATE POLICY "users_insert_own_campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_campaigns" ON campaigns;
CREATE POLICY "users_update_own_campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_campaigns" ON campaigns;
CREATE POLICY "users_delete_own_campaigns" ON campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- Service role (server) tüm kayıtları görebilir
DROP POLICY IF EXISTS "service_role_all_campaigns" ON campaigns;
CREATE POLICY "service_role_all_campaigns" ON campaigns
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ─── campaign_calls tablosu ─────────────────────────────────────────────────
-- Bu tabloya sadece service role yazıyor, kullanıcı kendi kampanyasıyla görebilir
ALTER TABLE campaign_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_campaign_calls" ON campaign_calls;
CREATE POLICY "users_view_own_campaign_calls" ON campaign_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_calls.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );

-- ─── leadflow_connections (her kullanıcının kendi API key'i) ────────────────
-- organization_id field'ı yerine user_id kullanılacak
ALTER TABLE leadflow_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leadflow_connections_user_id ON leadflow_connections(user_id);

-- API key otomatik UUID üret (mevcut değilse)
ALTER TABLE leadflow_connections
  ALTER COLUMN api_key SET DEFAULT gen_random_uuid()::text;

ALTER TABLE leadflow_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_connection" ON leadflow_connections;
CREATE POLICY "users_view_own_connection" ON leadflow_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_connection" ON leadflow_connections;
CREATE POLICY "users_insert_own_connection" ON leadflow_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_connection" ON leadflow_connections;
CREATE POLICY "users_update_own_connection" ON leadflow_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── contacts tablosu (LeadFlow'dan gelen lead'ler) ─────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_contacts" ON contacts;
CREATE POLICY "users_view_own_contacts" ON contacts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_contacts" ON contacts;
CREATE POLICY "users_insert_own_contacts" ON contacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_contacts" ON contacts;
CREATE POLICY "users_update_own_contacts" ON contacts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_contacts" ON contacts;
CREATE POLICY "users_delete_own_contacts" ON contacts
  FOR DELETE USING (auth.uid() = user_id);
