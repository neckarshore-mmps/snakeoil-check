import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalize } from '../normalize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', '__fixtures__');
const coaching = readFileSync(path.join(fixturesDir, 'sample-coaching.html'), 'utf-8');
const saas = readFileSync(path.join(fixturesDir, 'sample-saas.html'), 'utf-8');

describe('normalize: coaching fixture', () => {
  const doc = normalize(coaching, 'https://example.test/coach');

  it('extracts a non-empty title', () => {
    expect(doc.title.length).toBeGreaterThan(3);
  });

  it('extracts at least 3 headings', () => {
    expect(doc.headings.length).toBeGreaterThanOrEqual(3);
  });

  it('finds testimonial blocks via class match', () => {
    expect(doc.testimonialBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it('finds pricing mentions in EUR format', () => {
    expect(doc.pricingMentions.some((p) => p.includes('EUR'))).toBe(true);
  });

  it('body text is bounded by the 50k cap', () => {
    expect(doc.bodyText.length).toBeLessThanOrEqual(50_000);
  });
});

describe('normalize: saas fixture', () => {
  const doc = normalize(saas, 'https://example.test/saas');

  it('extracts headings without false positives from <nav>', () => {
    expect(doc.headings.every((h) => !/^nav/i.test(h))).toBe(true);
  });

  it('finds $ pricing', () => {
    expect(doc.pricingMentions.some((p) => p.includes('$'))).toBe(true);
  });
});

describe('normalize: truncation', () => {
  it('flags `truncated: true` when bodyText exceeds 50k chars', () => {
    const longBody = `<html><body>${'x '.repeat(30_000)}</body></html>`;
    const doc = normalize(longBody, 'https://example.test/long');
    expect(doc.truncated).toBe(true);
    expect(doc.bodyText.length).toBe(50_000);
  });
});
