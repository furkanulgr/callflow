-- ─── campaign_calls tablosu (webhook'tan gelen her arama kaydı) ───────────────
CREATE TABLE IF NOT EXISTS campaign_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  conversation_id TEXT UNIQUE NOT NULL,
  agent_id        TEXT,
  phone_number    TEXT,
  status          TEXT NOT NULL DEFAULT 'missed'
    CHECK (status IN ('answered', 'missed', 'failed', 'in_progress')),
  duration_secs   INT NOT NULL DEFAULT 0,
  call_successful TEXT DEFAULT 'unknown',
  raw_analysis    JSONB,
  occurred_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_calls_campaign_id     ON campaign_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_calls_conversation_id ON campaign_calls(conversation_id);

-- RLS kapat (service role key ile yazılacak)
ALTER TABLE campaign_calls DISABLE ROW LEVEL SECURITY;

-- ─── increment_campaign_stats RPC (atomic sayaç artırma) ─────────────────────
CREATE OR REPLACE FUNCTION increment_campaign_stats(
  p_campaign_id UUID,
  p_called      INT DEFAULT 1,
  p_answered    INT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE campaigns
  SET
    called   = COALESCE(called,   0) + p_called,
    answered = COALESCE(answered, 0) + p_answered
  WHERE id = p_campaign_id;
END;
$$;
