import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchResult } from '../../scraping';
import type { NormalizedDoc } from '../../scraping/normalize';

const mockFetchResult: FetchResult = {
  url: 'https://example.com',
  status: 200,
  html: '<html><body>fake page</body></html>',
  byteCount: 35,
  truncated: false,
};

const mockDoc: NormalizedDoc = {
  url: 'https://example.com',
  title: 'Example Page',
  headings: ['Heading 1'],
  bodyText: 'fake page content',
  testimonialBlocks: [],
  pricingMentions: [],
  charCount: 100,
  truncated: false,
};

const { fetchHtmlMock, normalizeMock } = vi.hoisted(() => ({
  fetchHtmlMock: vi.fn(),
  normalizeMock: vi.fn(),
}));

vi.mock('../../scraping', () => ({
  fetchHtml: fetchHtmlMock,
  FetchError: class FetchError extends Error {},
}));

vi.mock('../../scraping/normalize', () => ({
  normalize: normalizeMock,
}));

import { scrapeStep } from '../steps/scrape';

describe('scrapeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHtmlMock.mockResolvedValue(mockFetchResult);
    normalizeMock.mockReturnValue(mockDoc);
  });

  it('returns NormalizedDoc + raw_html_size', async () => {
    const result = await scrapeStep({ url: 'https://example.com' });

    expect(result.url).toBe('https://example.com');
    expect(result.doc).toEqual(mockDoc);
    expect(result.raw_html_size).toBe(35);
  });

  it('uses final URL after redirects (from FetchResult.url)', async () => {
    const redirectFetch = { ...mockFetchResult, url: 'https://example.com/final' };
    fetchHtmlMock.mockResolvedValue(redirectFetch);

    const result = await scrapeStep({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com/final');
  });

  it('handles fetch errors by re-throwing', async () => {
    fetchHtmlMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(scrapeStep({ url: 'https://bad.example.com' })).rejects.toThrow(/Network error/);
  });
});
