/**
 * Prompt builders — Phase 2 plan §Task 4.2.
 *
 * Two builders, both deterministic (no I/O, no clock, no randomness):
 *   - buildFullPrompt: all 12 criteria in one call (single-call strategy)
 *   - buildSingleCriterionPrompt: one criterion only (per-criterion strategy)
 *
 * The system message is identical for both — only the user message changes.
 * Hard rules in the system message enforce verbatim evidence + JSON-only
 * output. The schema-level validation in Task 4.3/4.4 catches any drift.
 */

import { CRITERIA, RUBRIC_VERSION } from '../scoring/criteria';
import type { NormalizedDoc } from '../scraping/normalize';

const SYSTEM = `You are evaluating an online offer for snake-oil indicators using a fixed 12-criterion rubric.

Hard rules:
- Use the rubric exactly. Do not invent criteria.
- raw_score is an integer 0..10 per the rubric band descriptions.
- evidence_quote is a verbatim extract from the provided scraped content (max 400 chars). If evidence is absent, write the literal string [no statement found] and score per the rubric's "absence" band.
- rationale is 1-2 sentences explaining why this evidence yields this score.
- Return JSON matching the schema strictly. No commentary outside the JSON.`;

const HEADING_DISPLAY_LIMIT = 30;
const TESTIMONIAL_DISPLAY_LIMIT = 12;

function rubricBlock(): string {
  return CRITERIA.map(
    (c) =>
      `  ${c.id}. ${c.name} (pillar=${c.pillar}, weight=${c.weight}) — rubric ref ${c.rubricRef}`,
  ).join('\n');
}

export function buildFullPrompt(doc: NormalizedDoc): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: [
      `Rubric version: ${RUBRIC_VERSION}`,
      '',
      'Criteria (id. name (pillar, weight) — rubric reference):',
      rubricBlock(),
      '',
      `Source URL: ${doc.url}`,
      `Title: ${doc.title}`,
      `Headings: ${doc.headings.slice(0, HEADING_DISPLAY_LIMIT).join(' | ')}`,
      '',
      'Pricing mentions extracted:',
      doc.pricingMentions.length ? doc.pricingMentions.join(' / ') : '(none detected)',
      '',
      'Testimonial blocks extracted:',
      doc.testimonialBlocks.length
        ? doc.testimonialBlocks.slice(0, TESTIMONIAL_DISPLAY_LIMIT).join('\n---\n')
        : '(none detected)',
      '',
      'Scraped body text:',
      doc.bodyText,
      '',
      'Return JSON with field `criteria` — an array of 12 objects, one per criterion id 1..12.',
    ].join('\n'),
  };
}

export function buildSingleCriterionPrompt(
  doc: NormalizedDoc,
  criterionId: number,
): { system: string; user: string } {
  const c = CRITERIA.find((x) => x.id === criterionId);
  if (!c) throw new Error(`Unknown criterion id ${criterionId}`);
  return {
    system: SYSTEM,
    user: [
      `Rubric version: ${RUBRIC_VERSION}`,
      'Evaluate exactly ONE criterion:',
      `  ${c.id}. ${c.name} (pillar=${c.pillar}, weight=${c.weight}) — rubric ref ${c.rubricRef}`,
      '',
      `Source URL: ${doc.url}`,
      `Title: ${doc.title}`,
      `Headings: ${doc.headings.slice(0, HEADING_DISPLAY_LIMIT).join(' | ')}`,
      '',
      'Pricing mentions:',
      doc.pricingMentions.length ? doc.pricingMentions.join(' / ') : '(none)',
      '',
      'Testimonial blocks:',
      doc.testimonialBlocks.length
        ? doc.testimonialBlocks.slice(0, TESTIMONIAL_DISPLAY_LIMIT).join('\n---\n')
        : '(none)',
      '',
      'Scraped body text:',
      doc.bodyText,
      '',
      `Return JSON with \`criteria\` — an array of exactly ONE object for criterion_id=${c.id}.`,
    ].join('\n'),
  };
}
