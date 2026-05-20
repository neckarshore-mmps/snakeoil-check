import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { StrategyResult } from '../../ai/strategies/single-call';
import type { NormalizedDoc } from '../../scraping/normalize';

// ── Shared mock data ─────────────────────────────────────────────────────────

const mockDoc: NormalizedDoc = {
  url: 'https://example.com',
  title: 'Coaching Offer',
  headings: ['Transform Your Life'],
  bodyText: 'coaching offer page content',
  testimonialBlocks: [],
  pricingMentions: ['€997'],
  charCount: 500,
  truncated: false,
};

const mockFetchResult = {
  url: 'https://example.com',
  status: 200,
  html: '<html><body>coaching offer page</body></html>',
  byteCount: 44,
  truncated: false,
};

const mockStrategyResult: StrategyResult = {
  scores: Array.from({ length: 12 }, (_, i) => ({
    criterionId: i + 1,
    rawScore: 6,
    evidenceQuote: `evidence for criterion ${i + 1}`,
    rationale: `rationale for criterion ${i + 1}`,
  })),
  model: 'anthropic/claude-haiku-4.5',
  latencyMs: 1500,
  inputTokens: 3000,
  outputTokens: 400,
};

// ── Hoisted mock functions ───────────────────────────────────────────────────

const { fetchHtmlMock, normalizeMock, scoreSingleCallMock, dbInsertMock } = vi.hoisted(() => {
  const insertChainMock = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'mock-check-id', resultToken: 'mock-token' }]),
  };
  return {
    fetchHtmlMock: vi.fn(),
    normalizeMock: vi.fn(),
    scoreSingleCallMock: vi.fn(),
    dbInsertMock: vi.fn().mockReturnValue(insertChainMock),
  };
});

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../scraping', () => ({
  fetchHtml: fetchHtmlMock,
  FetchError: class FetchError extends Error {},
}));

vi.mock('../../scraping/normalize', () => ({
  normalize: normalizeMock,
}));

vi.mock('../../ai/strategies/single-call', () => ({
  scoreSingleCall: scoreSingleCallMock,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'stub-anthropic-model'),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => 'stub-google-model'),
}));

vi.mock('../../../db', () => ({
  db: { insert: dbInsertMock },
}));

import { runSnakeOilCheckWorkflow } from '../snake-oil-check';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SnakeOilCheckWorkflow (integration)', () => {
  beforeAll(() => {
    // Router env vars
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5';
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic';
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5';
    process.env.ROUTER_FREESHOT_PROVIDER = 'google';
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-2.0-flash';
    // Mock return values
    fetchHtmlMock.mockResolvedValue(mockFetchResult);
    normalizeMock.mockReturnValue(mockDoc);
    scoreSingleCallMock.mockResolvedValue(mockStrategyResult);
  });

  it('runs end-to-end for standard tier', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'standard',
      signals: {},
    });

    expect(result.workflow_status).toBe('done');
    expect(result.result_token).toBe('mock-token');
    expect(result.check_id).toBe('mock-check-id');
  });

  it('runs end-to-end for free-shot tier', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'free-shot',
      signals: {},
    });

    expect(result.workflow_status).toBe('done');
    expect(result.result_token).toBe('mock-token');
  });

  it('runs end-to-end for deep tier with explicit deep flag', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'deep',
      signals: { customer_explicit_deep_analysis: true },
    });

    expect(result.workflow_status).toBe('done');
  });

  it('returns failed status when scraping throws', async () => {
    fetchHtmlMock.mockRejectedValueOnce(new Error('DNS failure'));

    const result = await runSnakeOilCheckWorkflow({
      url: 'https://unreachable.example.com',
      tier: 'standard',
      signals: {},
    });

    expect(result.workflow_status).toBe('failed');
    expect(result.error).toMatch(/DNS failure/);
  });
});
