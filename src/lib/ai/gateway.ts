/**
 * AI provider handle — Phase 2-A plan §Task 8.
 *
 * This is the ONLY place that constructs model handles. Strategies import
 * from here and never touch provider SDKs directly. Centralizing makes
 * provider/model swap a one-line change.
 *
 * Routing:
 *   - Locally: calls provider API directly via ANTHROPIC_API_KEY /
 *     GOOGLE_GENERATIVE_AI_API_KEY env vars
 *   - In Vercel runtime with AI Gateway enabled: VERCEL_OIDC_TOKEN
 *     auto-injected, Gateway intercepts when using @ai-sdk/gateway provider-strings.
 *     Current impl (@ai-sdk/anthropic + @ai-sdk/google) routes direct;
 *     Phase-3 migration to @ai-sdk/gateway provider-strings planned.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export interface ModelHandleSpec {
  provider: 'anthropic' | 'openai' | 'google';
  model_id: string;
}

/**
 * Multi-Model handle factory. Phase-2: anthropic + google supported.
 * Phase-3+: openai + BYOK customer keys.
 */
export function createModelHandle(spec: ModelHandleSpec) {
  switch (spec.provider) {
    case 'anthropic':
      return anthropic(spec.model_id);
    case 'google':
      return google(spec.model_id);
    case 'openai':
      // Future: import { openai } from '@ai-sdk/openai' once added as dep
      throw new Error('OpenAI provider not yet integrated. Add @ai-sdk/openai dep first.');
    default:
      throw new Error(`Unknown provider: ${spec.provider as string}`);
  }
}

// Legacy single-model handle — kept for backward compat with strategies/index.ts registry.
// Remove once all callers migrate to createModelHandle() via Router-Layer.
export const scorerModel = anthropic('claude-sonnet-4.5');
export const MODEL_LABEL = 'anthropic/claude-sonnet-4.5' as const;
export const MODEL_TEMPERATURE = 0 as const; // per scoring-framework.md §7
