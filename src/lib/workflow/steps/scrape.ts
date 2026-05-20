import { fetchHtml } from '../../scraping';
import type { NormalizedDoc } from '../../scraping/normalize';
import { normalize } from '../../scraping/normalize';

export interface ScrapeStepInput {
  url: string;
}

export interface ScrapeStepOutput {
  url: string;
  doc: NormalizedDoc;
  raw_html_size: number;
}

/**
 * Scrape step: fetch HTML from URL + normalize to structured NormalizedDoc.
 *
 * Marked "use step" for Vercel Workflow SDK — runs as a durable, resumable
 * step when called from within a "use workflow" orchestrator. In tests
 * (Vitest, no workflow transform), the directive is a no-op string literal.
 *
 * Plan divergence (documented): plan specifies normalized_content: string.
 * Actual: returns NormalizedDoc (structured object) since scraping/normalize.ts
 * exports `normalize()` returning NormalizedDoc, not a plain string. Score step
 * accepts NormalizedDoc directly for richer prompt-building.
 */
export async function scrapeStep(input: ScrapeStepInput): Promise<ScrapeStepOutput> {
  'use step';
  const fetchResult = await fetchHtml(input.url);
  const doc = normalize(fetchResult.html, fetchResult.url);

  return {
    url: fetchResult.url, // final URL after redirects
    doc,
    raw_html_size: fetchResult.byteCount,
  };
}
