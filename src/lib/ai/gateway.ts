/**
 * AI provider handle — Phase 2 plan §Task 4.1.
 *
 * This is the ONLY place that constructs a model handle. Strategies import
 * `scorerModel` and never touch `@ai-sdk/anthropic` or the Vercel Gateway
 * directly. Centralizing here makes provider/model swap a one-line change.
 *
 * Routing:
 *   - Locally: calls Anthropic API directly via `ANTHROPIC_API_KEY`
 *   - In Vercel runtime with AI Gateway enabled: `VERCEL_OIDC_TOKEN`
 *     auto-injected by Vercel, Gateway intercepts transparently
 */

import { anthropic } from '@ai-sdk/anthropic';

export const scorerModel = anthropic('claude-sonnet-4.5');
export const MODEL_LABEL = 'anthropic/claude-sonnet-4.5' as const;
export const MODEL_TEMPERATURE = 0 as const; // per scoring-framework.md §7
