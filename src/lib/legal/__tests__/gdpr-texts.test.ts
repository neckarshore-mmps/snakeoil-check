import { describe, expect, it } from 'vitest';
import { GDPR_TRANSACTIONAL_DE, GDPR_MARKETING_DE, GDPR_TEXTS } from '../gdpr-texts';

describe('GDPR texts constants', () => {
  it('should define correct German transactional consent text', () => {
    expect(GDPR_TRANSACTIONAL_DE).toBe(
      "Ich akzeptiere die Verarbeitung meiner Email für diesen Free-Check (notwendig für die Email-Bestätigung)."
    );
  });

  it('should define correct German marketing consent text', () => {
    expect(GDPR_MARKETING_DE).toBe(
      "Ich möchte gelegentlich Snake-Oil-Check Updates per Email erhalten (jederzeit widerrufbar)."
    );
  });

  it('should support i18n structure', () => {
    expect(GDPR_TEXTS.de.TRANSACTIONAL).toBe(GDPR_TRANSACTIONAL_DE);
    expect(GDPR_TEXTS.de.MARKETING).toBe(GDPR_MARKETING_DE);
  });
});
