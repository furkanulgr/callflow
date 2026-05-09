-- Appointments ve WhatsApp şablonları için tablolar
-- CalendarPage ve WhatsAppPage bu tabloları kullanıyor ancak migration eksikti

-- ─── appointments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id     TEXT,
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,
  appointment_date    DATE NOT NULL,
  appointment_time    TEXT,
  appointment_address TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  call_duration_secs  INTEGER DEFAULT 0,
  agent_id            TEXT,
  status              TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_user_id_idx       ON appointments(user_id);
CREATE INDEX IF NOT EXISTS appointments_appointment_date_idx ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS appointments_status_idx        ON appointments(status);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_appointments" ON appointments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_appointments" ON appointments
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── whatsapp_templates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  trigger_type TEXT NOT NULL
                 CHECK (trigger_type IN ('appointment_confirmed', 'hot_lead', 'cold_lead',
                                         'demo_invitation', 'appointment_reminder',
                                         'thank_you', 'custom')),
  message      TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_templates_user_id_idx ON whatsapp_templates(user_id);
CREATE INDEX IF NOT EXISTS whatsapp_templates_active_idx  ON whatsapp_templates(user_id, is_active);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_whatsapp_templates" ON whatsapp_templates
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_all_whatsapp_templates" ON whatsapp_templates
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

DROP TRIGGER IF EXISTS whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ─── organization_settings ────────────────────────────────────────────────────
-- Settings sayfasındaki ayarları DB'de saklamak için
-- (şu an localStorage'da tutuluyordu, cihaz değişince kayboluyor)
CREATE TABLE IF NOT EXISTS organization_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_gender    TEXT DEFAULT 'female_tr',
  greeting_message TEXT,
  language        TEXT DEFAULT 'tr',
  auto_answer     BOOLEAN DEFAULT false,
  call_recording  BOOLEAN DEFAULT true,
  call_summary    BOOLEAN DEFAULT true,
  daily_max_calls INTEGER DEFAULT 100,
  call_delay_secs INTEGER DEFAULT 5,
  notify_realtime BOOLEAN DEFAULT true,
  notify_missed   BOOLEAN DEFAULT true,
  notify_hot_lead BOOLEAN DEFAULT true,
  work_hours_enabled BOOLEAN DEFAULT false,
  work_hours_start TEXT DEFAULT '09:00',
  work_hours_end   TEXT DEFAULT '18:00',
  work_days        TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_settings" ON organization_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS organization_settings_updated_at ON organization_settings;
CREATE TRIGGER organization_settings_updated_at
  BEFORE UPDATE ON organization_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
