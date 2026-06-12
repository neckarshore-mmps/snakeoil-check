import React from 'react';
import { GDPR_TRANSACTIONAL_DE, GDPR_MARKETING_DE } from '@/lib/legal/gdpr-texts';

export interface GdprCheckboxesProps {
  /**
   * Optional initial checked state for the marketing checkbox.
   * Defaults to false.
   */
  defaultMarketingChecked?: boolean;
  /**
   * Optional className for styling the outer container.
   */
  className?: string;
}

/**
 * GDPR Consent Checkboxes Component.
 *
 * Renders two separate checkboxes:
 * 1. Transactional Consent (Required) - Gated for email-confirm validation.
 * 2. Marketing Consent (Optional) - Opt-in for occasional updates.
 */
export function GdprCheckboxes({
  defaultMarketingChecked = false,
  className = '',
}: GdprCheckboxesProps) {
  return (
    <div
      className={`gdpr-checkboxes-container ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.25rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.5rem',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        fontFamily: 'inherit',
      }}
    >
      {/* 1. Transactional Checkbox (Required) */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          lineHeight: '1.4',
          color: 'inherit',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          name="consent_transactional"
          required
          style={{
            marginTop: '0.2rem',
            width: '1rem',
            height: '1rem',
            cursor: 'pointer',
            accentColor: '#10b981', // green theme
          }}
        />
        <span>
          {GDPR_TRANSACTIONAL_DE}
          <span style={{ color: '#ef4444', marginLeft: '0.25rem' }}>*</span>
        </span>
      </label>

      {/* 2. Marketing Checkbox (Optional) */}
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          lineHeight: '1.4',
          color: 'inherit',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          name="consent_marketing"
          defaultChecked={defaultMarketingChecked}
          style={{
            marginTop: '0.2rem',
            width: '1rem',
            height: '1rem',
            cursor: 'pointer',
            accentColor: '#10b981', // green theme
          }}
        />
        <span>{GDPR_MARKETING_DE}</span>
      </label>
    </div>
  );
}
