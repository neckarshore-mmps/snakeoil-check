import { describe, expect, it } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { GdprCheckboxes } from '../gdpr-checkboxes';
import { GDPR_TRANSACTIONAL_DE, GDPR_MARKETING_DE } from '../../lib/legal/gdpr-texts';

describe('GdprCheckboxes component', () => {
  it('should render two checkboxes with correct name attributes', () => {
    const html = ReactDOMServer.renderToString(<GdprCheckboxes />);
    
    // Check for checkboxes structure
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="consent_transactional"');
    expect(html).toContain('name="consent_marketing"');
  });

  it('should enforce transactional consent as required', () => {
    const html = ReactDOMServer.renderToString(<GdprCheckboxes />);
    
    // Find the input element for transactional consent and verify it has the required attribute
    const transactionalInput = html.match(/<input[^>]*name="consent_transactional"[^>]*>/)?.[0] || '';
    expect(transactionalInput).toContain('required');
    
    // Find the input element for marketing consent and verify it does NOT have the required attribute
    const marketingInput = html.match(/<input[^>]*name="consent_marketing"[^>]*>/)?.[0] || '';
    expect(marketingInput).not.toContain('required');
  });

  it('should render correct German GDPR label texts', () => {
    const html = ReactDOMServer.renderToString(<GdprCheckboxes />);
    
    expect(html).toContain(GDPR_TRANSACTIONAL_DE);
    expect(html).toContain(GDPR_MARKETING_DE);
  });

  it('should allow defaulting the marketing checkbox state', () => {
    const htmlWithDefault = ReactDOMServer.renderToString(
      <GdprCheckboxes defaultMarketingChecked={true} />
    );
    expect(htmlWithDefault).toMatch(/name="consent_marketing"[^>]*checked/);

    const htmlWithoutDefault = ReactDOMServer.renderToString(
      <GdprCheckboxes defaultMarketingChecked={false} />
    );
    expect(htmlWithoutDefault).not.toMatch(/name="consent_marketing"[^>]*checked/);
  });
});
