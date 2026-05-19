/**
 * Cheerio-based normalizer — Phase 2 plan §Task 3.2.
 *
 * Turns raw salespage HTML into a `NormalizedDoc` suitable for AI input.
 * Strips noise (script/style/nav/footer), extracts title + headings +
 * testimonials + pricing mentions, caps body text at 50k chars (the
 * cost/latency floor for Sonnet 4.5 input).
 *
 * Testimonial detection is two-fold:
 *   1. Elements with class names matching /testimonial|bewertung|kundenstimme|quote/i
 *   2. Sibling blockquotes/paragraphs after headings matching
 *      /stimmen|reviews?|testimonial|kundenmeinungen/i
 *
 * Pricing detection uses a regex covering `€`, `EUR`, `$`, and `USD`. The
 * regex intentionally matches only digit-prefixed amounts to avoid hitting
 * unrelated symbols (e.g., "Euro" prose mentions without a number).
 */

import * as cheerio from 'cheerio';

const BODY_TEXT_CAP = 50_000;
// Two alternatives: prefix-currency (US-style "$8", "$1,500") and
// suffix-currency (German "8 EUR" / "8 €" or generic "8 USD" / "8 $").
const PRICING_RE =
  /\$\s*\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d{1,4}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:€|EUR|\$|USD)/g;
const TESTIMONIAL_CLASS_RE = /testimonial|bewertung|kundenstimme|quote/i;
const TESTIMONIAL_HEADING_RE = /stimmen|reviews?|testimonial|kundenmeinungen/i;
const TESTIMONIAL_MIN_LEN = 20;
const TESTIMONIAL_MAX_LEN = 1000;
const TESTIMONIAL_MAX_COUNT = 30;
const PRICING_MAX_COUNT = 50;
const SIBLING_SCAN_LIMIT = 6;

export interface NormalizedDoc {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  testimonialBlocks: string[];
  pricingMentions: string[];
  charCount: number;
  truncated: boolean;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function normalize(html: string, sourceUrl: string): NormalizedDoc {
  const $ = cheerio.load(html);

  // Strip noise BEFORE any text extraction.
  $('script, style, noscript, nav, footer, iframe, svg').remove();

  const title = collapseWhitespace($('title').first().text() || $('h1').first().text() || '');

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = collapseWhitespace($(el).text());
    if (t) headings.push(t);
  });

  // Testimonial blocks — Set dedupes identical strings.
  const tb = new Set<string>();
  $('[class]').each((_, el) => {
    const cls = $(el).attr('class') ?? '';
    if (TESTIMONIAL_CLASS_RE.test(cls)) {
      const t = collapseWhitespace($(el).text());
      if (t.length >= TESTIMONIAL_MIN_LEN && t.length <= TESTIMONIAL_MAX_LEN) {
        tb.add(t);
      }
    }
  });
  $('h1, h2, h3').each((_, el) => {
    if (TESTIMONIAL_HEADING_RE.test($(el).text())) {
      $(el)
        .nextAll('blockquote, p')
        .slice(0, SIBLING_SCAN_LIMIT)
        .each((_, sib) => {
          const t = collapseWhitespace($(sib).text());
          if (t.length >= TESTIMONIAL_MIN_LEN && t.length <= TESTIMONIAL_MAX_LEN) {
            tb.add(t);
          }
        });
    }
  });

  // Body text — collapse first, then measure, then cap.
  let bodyText = collapseWhitespace($('body').text());
  const charCount = bodyText.length;
  const truncated = charCount > BODY_TEXT_CAP;
  if (truncated) bodyText = bodyText.slice(0, BODY_TEXT_CAP);

  // Pricing mentions — iterate via matchAll (idiomatic, no lastIndex bookkeeping).
  const pricing = new Set<string>();
  for (const match of bodyText.matchAll(PRICING_RE)) {
    pricing.add(match[0]);
    if (pricing.size >= PRICING_MAX_COUNT) break;
  }

  return {
    url: sourceUrl,
    title,
    headings,
    bodyText,
    testimonialBlocks: Array.from(tb).slice(0, TESTIMONIAL_MAX_COUNT),
    pricingMentions: Array.from(pricing),
    charCount,
    truncated,
  };
}
