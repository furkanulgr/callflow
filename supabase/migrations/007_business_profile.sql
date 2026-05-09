-- Business profile fields on organization_settings
-- Onboarding sihirbazının doldurduğu işletme bilgileri burada tutulur.

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_type        TEXT,
  ADD COLUMN IF NOT EXISTS business_name        TEXT,
  ADD COLUMN IF NOT EXISTS services             TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS working_hours        JSONB   NOT NULL DEFAULT '{}';

-- business_type için olası değerler (zorunlu değil — sadece belgeleme)
-- 'dental'    → Diş Kliniği
-- 'beauty'    → Güzellik Salonu / Kuaför
-- 'restaurant'→ Restoran / Kafe
-- 'gym'       → Spor Salonu / Fitness
-- 'print'     → Matbaa / Baskı
-- 'design'    → Grafik / Tasarım Stüdyosu
-- 'other'     → Diğer

COMMENT ON COLUMN organization_settings.onboarding_completed IS
  'true → kullanıcı ilk kurulum sihirbazını tamamladı';
COMMENT ON COLUMN organization_settings.business_type IS
  'Sektör kodu: dental | beauty | restaurant | gym | print | design | other';
COMMENT ON COLUMN organization_settings.business_name IS
  'İşletme ticari adı (onboarding adım 2)';
COMMENT ON COLUMN organization_settings.services IS
  'Sunulan hizmetler listesi (onboarding adım 2)';
COMMENT ON COLUMN organization_settings.working_hours IS
  'Çalışma saatleri JSON: { mon: "09:00-18:00", ... }';
