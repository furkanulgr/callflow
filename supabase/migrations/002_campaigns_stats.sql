-- Kampanya istatistik kolonları (eğer yoksa ekle)
-- Bu migration, 001'deki schema ile uyumsuzluğu giderir

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS called        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answered      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hot_leads     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cold_leads    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS appointments  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS batch_id      TEXT,
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS daily_limit   INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Status değerlerini güncelle (active/paused/completed/draft desteklensin)
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'completed', 'scheduled', 'running', 'cancelled'));

-- Index: batch_id ile hızlı arama
CREATE INDEX IF NOT EXISTS idx_campaigns_batch_id ON campaigns(batch_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id  ON campaigns(user_id);
