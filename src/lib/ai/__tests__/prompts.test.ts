import { describe, expect, it } from 'vitest';
import { CRITERIA } from '../../scoring/criteria';
import type { NormalizedDoc } from '../../scraping/normalize';
import { buildFullPrompt, buildSingleCriterionPrompt } from '../prompts';

const doc: NormalizedDoc = {
  url: 'https://example.test/x',
  title: 'Test offer',
  headings: ['H1', 'H2'],
  bodyText: 'body text here',
  testimonialBlocks: ['Alice — fantastic'],
  pricingMentions: ['1.000 EUR'],
  charCount: 14,
  truncated: false,
};

describe('buildFullPrompt', () => {
  const p = buildFullPrompt(doc);

  it('includes the URL, title, body, and all 12 criterion names', () => {
    expect(p.user).toContain('https://example.test/x');
    expect(p.user).toContain('Test offer');
    expect(p.user).toContain('body text here');
    for (const c of CRITERIA) {
      expect(p.user).toContain(c.name);
    }
  });

  it('declares the rubric version in the user message', () => {
    expect(p.user).toContain('Rubric version:');
  });

  it('has a non-empty system message with verbatim-evidence rule', () => {
    expect(p.system.length).toBeGreaterThan(0);
    expect(p.system).toContain('verbatim');
  });
});

describe('buildSingleCriterionPrompt', () => {
  it('emits ONLY the requested criterion name', () => {
    const p = buildSingleCriterionPrompt(doc, 7);
    expect(p.user).toContain('Price-to-Value Transparency');
    expect(p.user).not.toContain('Specificity of Promises');
    expect(p.user).toContain('criterion_id=7');
  });

  it('throws on unknown id', () => {
    expect(() => buildSingleCriterionPrompt(doc, 999)).toThrow();
  });

  it('shares the same system message as the full prompt', () => {
    const full = buildFullPrompt(doc);
    const single = buildSingleCriterionPrompt(doc, 1);
    expect(single.system).toBe(full.system);
  });
});
