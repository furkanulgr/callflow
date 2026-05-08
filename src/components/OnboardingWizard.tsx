/**
 * OnboardingWizard — LUERA CallFlow
 *
 * İlk giriş yapan kullanıcıya gösterilen 3 adımlı kurulum sihirbazı.
 * Tasarım: LUERA LeadFlow onboarding referansı (koyu tema, numbered progress bar)
 *
 * Adım 1 — Sektör seç (12 sektör, ikon grid)
 * Adım 2 — İşletme bilgileri (ad, iletişim, hizmetler, şehir)
 * Adım 3 — Her şey hazır! (özet + dashboard CTA)
 */

import { useState } from "react";
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  UtensilsCrossed, Sparkles, Heart, Car, Hammer,
  GraduationCap, ShoppingBag, Scale, Calculator,
  Home, Code2, Building2, ArrowRight, MapPin, Phone,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import { BusinessType, PROMPT_TEMPLATES } from "@/data/promptTemplates";

// ─── Sektör tanımları ─────────────────────────────────────────────────────────

interface SectorOption {
  type: BusinessType;
  label: string;
  description: string;
  Icon: React.ElementType;
}

const SECTORS: SectorOption[] = [
  { type: "restaurant",   label: "Restoran",              description: "Kafe, bistro, fast-food",          Icon: UtensilsCrossed },
  { type: "beauty",       label: "Güzellik",              description: "Kuaför, estetik, spa",             Icon: Sparkles        },
  { type: "health",       label: "Sağlık & Klinik",       description: "Diş, poliklinik, veteriner",       Icon: Heart           },
  { type: "automotive",   label: "Otomotiv",              description: "Servis, yedek parça, kiralama",    Icon: Car             },
  { type: "construction", label: "İnşaat & Tadilat",      description: "Renovasyon, dekorasyon",           Icon: Hammer          },
  { type: "education",    label: "Eğitim & Kurslar",      description: "Dershane, kurs, özel ders",        Icon: GraduationCap   },
  { type: "retail",       label: "Perakende & Mağaza",    description: "Giyim, elektronik, market",        Icon: ShoppingBag     },
  { type: "legal",        label: "Hukuk & Danışmanlık",   description: "Avukat, hukuk bürosu",             Icon: Scale           },
  { type: "accounting",   label: "Muhasebe & Finans",     description: "Mali müşavir, muhasebe",           Icon: Calculator      },
  { type: "realestate",   label: "Gayrimenkul",           description: "Emlak alım-satım, kiralama",       Icon: Home            },
  { type: "tech",         label: "Teknoloji & Yazılım",   description: "Yazılım, uygulama, IT hizmetleri", Icon: Code2           },
  { type: "other",        label: "Diğer",                 description: "Her türlü işletme",                Icon: Building2       },
];

// ─── Şehirler ─────────────────────────────────────────────────────────────────

const CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Adana", "Konya", "Gaziantep", "Mersin", "Kayseri",
  "Eskişehir", "Samsun", "Trabzon", "Diyarbakır", "Diğer",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  onComplete: () => void;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const STEP_LABELS = ["Sektör", "İşletme", "Hazır"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center">
            {/* Connector line — before first circle except for first item */}
            {i > 0 && (
              <div className={cn(
                "h-px w-12 sm:w-20 transition-colors duration-500",
                done ? "bg-[#CCFF00]" : "bg-white/10"
              )} />
            )}

            {/* Circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 border-2",
                done
                  ? "bg-[#CCFF00] border-[#CCFF00] text-gray-900"
                  : active
                    ? "bg-transparent border-[#CCFF00] text-[#CCFF00]"
                    : "bg-transparent border-white/20 text-white/30"
              )}>
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </div>
              <span className={cn(
                "text-[11px] font-semibold whitespace-nowrap transition-colors duration-300",
                done || active ? "text-white/80" : "text-white/25"
              )}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OnboardingWizard({ userId, onComplete }: Props) {
  const [step, setStep] = useState(0);

  // Step 1
  const [sector, setSector]   = useState<BusinessType | null>(null);

  // Step 2
  const [businessName, setBusinessName]   = useState("");
  const [contactName,  setContactName]    = useState("");
  const [services,     setServices]       = useState("");
  const [city,         setCity]           = useState("");

  // Save
  const [isSaving, setIsSaving] = useState(false);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSaveAndFinish = async () => {
    setIsSaving(true);
    try {
      const servicesList = services
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      await supabase.from("organization_settings").upsert({
        user_id:              userId,
        onboarding_completed: true,
        business_type:        sector,
        business_name:        businessName.trim() || null,
        services:             servicesList,
        working_hours:        { city },
      }, { onConflict: "user_id" });

      onComplete();
    } catch {
      // Supabase error — complete anyway so user is not blocked
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const canNext = [
    sector !== null,
    businessName.trim().length > 0,
  ][step] ?? true;

  const goNext = () => {
    if (step === 1) {
      setStep(2); // go to summary
    } else if (step < 2) {
      setStep(s => s + 1);
    }
  };

  const goBack = () => setStep(s => s - 1);

  // Sector label for summary
  const sectorInfo = SECTORS.find(s => s.type === sector);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[200] bg-[#0d0d0d] flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-white">LUERA</span>
          <span className="text-sm font-medium text-white/40">CallFlow</span>
        </div>
        <ProgressBar current={step} />
        {/* Spacer to balance layout */}
        <div className="w-[120px] hidden sm:block" />
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══════════════════════ STEP 1 — SEKTÖR ══════════════════════ */}
        {step === 0 && (
          <div className="max-w-3xl mx-auto px-4 py-10">
            <div className="mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#CCFF00] mb-3">Adım 1</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
                Sektörünüzü seçin
              </h1>
              <p className="text-white/40 text-base">
                AI asistanınız seçtiğiniz sektöre göre özelleştirilecek.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SECTORS.map(s => {
                const selected = sector === s.type;
                const Icon = s.Icon;
                return (
                  <button
                    key={s.type}
                    onClick={() => setSector(s.type)}
                    className={cn(
                      "group relative flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all duration-200 text-left",
                      selected
                        ? "bg-[#CCFF00]/10 border-[#CCFF00] text-white"
                        : "bg-white/[0.03] border-white/8 hover:bg-white/[0.07] hover:border-white/20 text-white/70"
                    )}
                  >
                    {/* Selected check */}
                    {selected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#CCFF00] flex items-center justify-center">
                        <Check className="w-3 h-3 text-gray-900" strokeWidth={3} />
                      </div>
                    )}

                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selected ? "bg-[#CCFF00]/20" : "bg-white/5 group-hover:bg-white/10"
                    )}>
                      <Icon className={cn("w-5 h-5", selected ? "text-[#CCFF00]" : "text-white/50 group-hover:text-white/70")} />
                    </div>

                    <div>
                      <p className={cn("text-sm font-bold leading-tight", selected ? "text-white" : "text-white/80")}>
                        {s.label}
                      </p>
                      <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                        {s.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════ STEP 2 — İŞLETME ══════════════════════ */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto px-4 py-10">
            <div className="mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-[#CCFF00] mb-3">Adım 2</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-2">
                İşletme bilgileriniz
              </h1>
              <p className="text-white/40 text-base">
                Asistanınızın müşterilere doğru bilgi vermesi için gereken detaylar.
              </p>
            </div>

            <div className="space-y-5">
              {/* İşletme adı */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  İşletme Adı <span className="text-[#CCFF00]">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Örn: Sağlık Diş Kliniği, Studio Glow..."
                    autoFocus
                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-white/20 focus:border-[#CCFF00]/50 focus:bg-white/8 focus:ring-1 focus:ring-[#CCFF00]/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* İletişim adı */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  İletişim Adı
                  <span className="ml-2 text-white/20 font-normal normal-case tracking-normal">(opsiyonel)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-white/20 focus:border-[#CCFF00]/50 focus:bg-white/8 focus:ring-1 focus:ring-[#CCFF00]/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Hizmetler */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                  Ne sunuyorsunuz?
                  <span className="ml-2 text-white/20 font-normal normal-case tracking-normal">(virgülle ayırın)</span>
                </label>
                <textarea
                  value={services}
                  onChange={e => setServices(e.target.value)}
                  placeholder={
                    sector === "health"    ? "Muayene, Dolgu, Ortodonti, Kanal Tedavisi..." :
                    sector === "beauty"    ? "Saç Kesimi, Manikür, Cilt Bakımı, Lazer..." :
                    sector === "restaurant"? "Akşam Yemeği, Öğle Menüsü, Özel Etkinlik..." :
                    "Hizmet 1, Hizmet 2, Hizmet 3..."
                  }
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-white/20 focus:border-[#CCFF00]/50 focus:bg-white/8 focus:ring-1 focus:ring-[#CCFF00]/20 outline-none transition-all resize-none"
                />
              </div>

              {/* Şehir */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
                  <MapPin className="inline w-3.5 h-3.5 mr-1 mb-0.5" />
                  Şehir
                  <span className="ml-2 text-white/20 font-normal normal-case tracking-normal">(opsiyonel)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CITIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setCity(prev => prev === c ? "" : c)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150",
                        city === c
                          ? "bg-[#CCFF00] border-[#CCFF00] text-gray-900"
                          : "bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/75"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ STEP 3 — HAZIR ══════════════════════ */}
        {step === 2 && (
          <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center text-center">
            {/* Celebration */}
            <div className="mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#CCFF00] mb-3">Her şey hazır!</p>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
                Kurulumunuz tamamlandı
              </h1>
              <p className="text-white/40 text-base max-w-md mx-auto">
                AI asistanınız artık kullanıma hazır. Dashboard'dan kampanyalarınızı yönetmeye başlayabilirsiniz.
              </p>
            </div>

            {/* Summary grid */}
            <div className="w-full bg-white/[0.04] border border-white/8 rounded-2xl p-6 mb-8 text-left">
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-5">Kurulum Özeti</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">

                <div>
                  <p className="text-[11px] text-white/30 font-medium mb-1">Sektör</p>
                  <div className="flex items-center gap-2">
                    {sectorInfo && (
                      <div className="w-7 h-7 rounded-lg bg-[#CCFF00]/10 flex items-center justify-center flex-shrink-0">
                        <sectorInfo.Icon className="w-3.5 h-3.5 text-[#CCFF00]" />
                      </div>
                    )}
                    <p className="text-sm font-bold text-white">{sectorInfo?.label ?? "—"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-white/30 font-medium mb-1">Şehir</p>
                  <p className="text-sm font-bold text-white">{city || "Belirtilmedi"}</p>
                </div>

                <div>
                  <p className="text-[11px] text-white/30 font-medium mb-1">İşletme</p>
                  <p className="text-sm font-bold text-white truncate">{businessName || "—"}</p>
                </div>

                <div>
                  <p className="text-[11px] text-white/30 font-medium mb-1">İletişim</p>
                  <p className="text-sm font-bold text-white">{contactName || "Belirtilmedi"}</p>
                </div>

                {services && (
                  <div className="col-span-2">
                    <p className="text-[11px] text-white/30 font-medium mb-1">Hizmetler</p>
                    <p className="text-sm font-medium text-white/70 leading-relaxed">{services}</p>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp reminder */}
            <div className="w-full flex items-start gap-3 bg-white/[0.03] border border-white/8 rounded-xl p-4 mb-2 text-left">
              <span className="text-xl flex-shrink-0">💬</span>
              <div>
                <p className="text-sm font-bold text-white">WhatsApp Entegrasyonu</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Dashboard'dan WhatsApp şablonlarınızı ekleyerek arama sonrası otomatik mesaj gönderebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0d0d0d] px-4 py-4 flex items-center justify-between">
        {/* Back */}
        {step > 0 && step < 2 ? (
          <button
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>
        ) : (
          <div />
        )}

        {/* Next / Finish */}
        {step < 2 && (
          <button
            onClick={goNext}
            disabled={!canNext}
            className={cn(
              "flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm transition-all duration-200",
              canNext
                ? "bg-[#CCFF00] text-gray-900 hover:brightness-110 active:scale-95 shadow-[0_4px_24px_rgba(204,255,0,0.25)]"
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            Devam Et
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {step === 2 && (
          <button
            onClick={handleSaveAndFinish}
            disabled={isSaving}
            className="flex items-center gap-2 px-7 py-3 rounded-xl font-black text-sm bg-[#CCFF00] text-gray-900 hover:brightness-110 active:scale-95 shadow-[0_4px_24px_rgba(204,255,0,0.25)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Kaydediliyor...</>
            ) : (
              <>Dashboard'a Başla <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
