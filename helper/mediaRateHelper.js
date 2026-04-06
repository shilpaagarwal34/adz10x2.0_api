const DEFAULT_PLATFORM_COMMISSION_PCT = 25;
const WHATSAPP_PLATFORM_COMMISSION_PCT = 25; // Align WhatsApp commission with global default

const MEDIA_TYPES = [
  "lift_branding_panels",
  "notice_board_sponsorship",
  "gate_entry_exit_branding",
  "society_kiosk",
  "society_newsletter_sponsor_slots",
  "whatsapp_promotional_day",
  "event_sponsorship",
];

const MEDIA_PLATFORM_CONFIG = {
  lift_branding_panels: {
    label: "Lift branding panels",
    min_lead_days: 2,
    min_active_days: 30,
    generic_terms: "Branding creatives should comply with society branding guidelines.",
  },
  notice_board_sponsorship: {
    label: "Notice board sponsorship",
    min_lead_days: 2,
    min_active_days: 15,
    generic_terms: "Notice board creatives will be displayed in approved common areas only.",
  },
  gate_entry_exit_branding: {
    label: "Gate entry/exit branding",
    min_lead_days: 2,
    min_active_days: 20,
    generic_terms: "Gate branding should not obstruct security visibility or safety signage.",
  },
  society_kiosk: {
    label: "Society kiosk",
    min_lead_days: 2,
    min_active_days: 10,
    generic_terms: "Kiosk setup and teardown should follow society timing and access rules.",
  },
  society_newsletter_sponsor_slots: {
    label: "Society newsletter sponsor slots",
    min_lead_days: 2,
    min_active_days: 30,
    generic_terms: "Newsletter sponsorship content is subject to editorial approval.",
  },
  whatsapp_promotional_day: {
    label: "WhatsApp promotional day",
    min_lead_days: 1,
    min_active_days: 1,
    generic_terms: "Promotional messages should be non-spam and shared only in approved groups.",
  },
  event_sponsorship: {
    label: "Event sponsorship",
    min_lead_days: 3,
    min_active_days: 7,
    generic_terms: "Event sponsorship material should follow event-specific society policy.",
  },
};

const SOCIETY_APPENDABLE_TERMS_OPTIONS = [
  "Creative file should be shared at least 48 hours before publishing.",
  "Society approval is mandatory before any live display.",
  "Any policy violation may lead to immediate campaign removal.",
  "Rates exclude applicable taxes and statutory charges.",
  "Display schedule may be adjusted due to maintenance or emergencies.",
];

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function normalizeMediaType(mediaType) {
  return (mediaType || "").toString().trim().toLowerCase();
}

function getPlatformCommissionPct(mediaType) {
  const normalized = normalizeMediaType(mediaType);
  if (normalized === "whatsapp_promotional_day") {
    return WHATSAPP_PLATFORM_COMMISSION_PCT;
  }
  return DEFAULT_PLATFORM_COMMISSION_PCT;
}

function calculateRateBreakup(societyRate, mediaType) {
  const parsedSocietyRate = Number(societyRate) || 0;
  const commissionPct = getPlatformCommissionPct(mediaType);
  const platformRate = Number(((parsedSocietyRate * commissionPct) / 100).toFixed(2));
  const companyRate = Number((parsedSocietyRate + platformRate).toFixed(2));

  return {
    society_rate: parsedSocietyRate,
    platform_commission_pct: commissionPct,
    platform_rate: platformRate,
    company_rate: companyRate,
  };
}

function isValidMediaType(mediaType) {
  return MEDIA_TYPES.includes(normalizeMediaType(mediaType));
}

function getMediaPlatformConfig(mediaType) {
  const normalized = normalizeMediaType(mediaType);
  const config = MEDIA_PLATFORM_CONFIG[normalized];
  if (config) {
    return {
      ...config,
      duration_days: config.min_active_days,
    };
  }
  return (
    {
      label: normalized || "Unknown platform",
      min_lead_days: 0,
      min_active_days: 0,
      duration_days: 0,
      generic_terms: "",
    }
  );
}

function normalizeAvailabilityDays(days) {
  if (!Array.isArray(days)) return [];
  return Array.from(
    new Set(
      days
        .map((d) => (d || "").toString().trim().toLowerCase())
        .filter((d) => WEEKDAY_KEYS.includes(d))
    )
  );
}

function normalizeAvailabilityMonthDays(days) {
  if (!Array.isArray(days)) return [];
  return Array.from(
    new Set(
      days
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 31)
    )
  ).sort((a, b) => a - b);
}

function isDateAllowedByAvailability(
  targetDate,
  availabilityDays = [],
  availabilityMonthDays = []
) {
  const d = new Date(targetDate);
  if (Number.isNaN(d.getTime())) return false;

  const normalizedDays = normalizeAvailabilityDays(availabilityDays);
  const normalizedMonthDays = normalizeAvailabilityMonthDays(availabilityMonthDays);

  if (normalizedDays.length) {
    const weekday = WEEKDAY_KEYS[d.getDay()];
    if (!normalizedDays.includes(weekday)) return false;
  }

  if (normalizedMonthDays.length) {
    const monthDay = d.getDate();
    if (!normalizedMonthDays.includes(monthDay)) return false;
  }

  return true;
}

module.exports = {
  MEDIA_TYPES,
  MEDIA_PLATFORM_CONFIG,
  SOCIETY_APPENDABLE_TERMS_OPTIONS,
  WEEKDAY_KEYS,
  normalizeMediaType,
  isValidMediaType,
  calculateRateBreakup,
  getPlatformCommissionPct,
  getMediaPlatformConfig,
  normalizeAvailabilityDays,
  normalizeAvailabilityMonthDays,
  isDateAllowedByAvailability,
};
