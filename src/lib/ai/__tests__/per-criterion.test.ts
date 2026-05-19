import { describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted to the top of the file, so the factory cannot close
// over module-scope variables defined below it. Use vi.hoisted to declare
// the mock fn in a hoisted block.
const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(async ({ prompt }: { prompt: string }) => {
    const m = prompt.match(/criterion_id=(\d+)/);
    const id = m ? Number(m[1]) : 0;
    return {
      object: {
        criteria: [
          {
            criterion_id: id,
            raw_score: id, // distinct per criterion so we can prove sort
            evidence_quote: `stub-${id}`,
            rationale: `stub rationale ${id}`,
          },
        ],
      },
      usage: { promptTokens: 100, completionTokens: 50 },
    };
  }),
}));

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'stub-model'),
}));

import type { NormalizedDoc } from '../../scraping/normalize';
import { scorePerCriterion } from '../strategies/per-criterion';

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

describe('scorePerCriterion', () => {
  it('calls generateObject exactly 12 times (once per criterion)', async () => {
    generateObjectMock.mockClear();
    await scorePerCriterion(doc);
    expect(generateObjectMock).toHaveBeenCalledTimes(12);
  });

  it('returns 12 scores sorted by criterionId ascending', async () => {
    const r = await scorePerCriterion(doc);
    expect(r.scores).toHaveLength(12);
    const ids = r.scores.map((s) => s.criterionId);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('aggregates token usage across the 12 calls', async () => {
    const r = await scorePerCriterion(doc);
    expect(r.inputTokens).toBe(12 * 100);
    expect(r.outputTokens).toBe(12 * 50);
  });

  it('attaches model label', async () => {
    const r = await scorePerCriterion(doc);
    expect(r.model).toBe('anthropic/claude-sonnet-4.5');
  });
});
