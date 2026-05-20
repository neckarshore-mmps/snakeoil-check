import { describe, expect, it, vi } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(async () => ({
    object: {
      criteria: Array.from({ length: 12 }, (_, i) => ({
        criterion_id: i + 1,
        raw_score: 5,
        evidence_quote: 'stub',
        rationale: 'stub rationale',
      })),
    },
    usage: { promptTokens: 1000, completionTokens: 500 },
  })),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'stub-model'),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'stub-google-model'),
}));

import type { NormalizedDoc } from '../../scraping/normalize';
import { scoreSingleCall } from '../strategies/single-call';

const doc: NormalizedDoc = {
  url: 'https://example.test/x',
  title: 't',
  headings: [],
  bodyText: 'b',
  testimonialBlocks: [],
  pricingMentions: [],
  charCount: 1,
  truncated: false,
};

describe('scoreSingleCall', () => {
  it('returns 12 scores with token usage', async () => {
    const r = await scoreSingleCall(doc);
    expect(r.scores).toHaveLength(12);
    expect(r.inputTokens).toBe(1000);
    expect(r.outputTokens).toBe(500);
  });

  it('attaches model label and non-negative latency', async () => {
    const r = await scoreSingleCall(doc);
    expect(r.model).toBe('anthropic/claude-sonnet-4.5');
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('maps snake_case AI fields to camelCase CriterionScore', async () => {
    const r = await scoreSingleCall(doc);
    const first = r.scores[0];
    expect(first).toBeDefined();
    expect(first?.criterionId).toBe(1);
    expect(first?.rawScore).toBe(5);
    expect(first?.evidenceQuote).toBe('stub');
    expect(first?.rationale).toBe('stub rationale');
  });
});
