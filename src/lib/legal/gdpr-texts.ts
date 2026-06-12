// Canonical GDPR consent text constants (DE-only at MVP, i18n-ready structure)
export const GDPR_TRANSACTIONAL_DE = "Ich akzeptiere die Verarbeitung meiner Email für diesen Free-Check (notwendig für die Email-Bestätigung).";
export const GDPR_MARKETING_DE = "Ich möchte gelegentlich Snake-Oil-Check Updates per Email erhalten (jederzeit widerrufbar).";

export const GDPR_TEXTS = {
  de: {
    TRANSACTIONAL: GDPR_TRANSACTIONAL_DE,
    MARKETING: GDPR_MARKETING_DE,
  },
} as const;
