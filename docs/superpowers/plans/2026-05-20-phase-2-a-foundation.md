# Phase-2-A Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Post-execution note (2026-06-06):** This plan was implemented (PR #16, merged) with **six deliberate divergences from the spec** — see [Implementation Divergences](#implementation-divergences-post-execution-annotation--2026-06-06) at the end before treating any task body as 1:1 with the shipped code.

**Goal:** Build the multi-model routing infrastructure, DB schema foundation, durable Vercel Workflow pipeline, and empirical benchmarks that all subsequent Phase-2 tiers (Revenue + Frontend) depend on.

**Architecture:** Plugin-Signal Router-Layer (env-driven model-selection) sits between business-logic and AI-providers. Vercel AI Gateway is the only path in Phase-2 (BYOK Direct-Path is Phase-3+). Drizzle migrations add `checks` + `check_results` tables. Vercel Workflow orchestrates durable scrape→score→ai→persist pipeline. Two benchmarks validate model-strategy: Strategy-Benchmark (single-call vs per-criterion on Sonnet, Bob's existing §8 #1) + Cross-Model-Benchmark (Haiku vs Sonnet vs Gemini Flash, NEW Task 5b).

**Tech Stack additions:**
- `@ai-sdk/google` ^1.0.x (Gemini Flash for Free-Shot + dev-default)
- Drizzle migrations (existing setup, Phase-1)
- `@vercel/workflow` ^4.x (existing dep from Bob's Task 1, PR #9)

**Working-Dir Discipline:** Every Bash command starts with `cd ~/Developer/projects/neckarshore-ai/snakeoil-check && ...`.

**Branch Strategy:** New feature-branch `bob/2026-05-21-phase-2-a-foundation` off main. One PR per logical block (Tasks 1-6 = Router-Layer-PR, Tasks 7-9 = DB+Workflow-PR, Tasks 10-12 = Benchmarks-PR). Or single stacked-style branch if Bob prefers; this time without the cascade-mistake from 2026-05-20.

**Prerequisites Verified:**
- ✅ Phase-1 Done (Bob's Task 1, PR #9 merged)
- ✅ Phase-2 Tasks 2-4 Done (PR #13 merged: scoring rubric, scraping, ai-gateway-skeleton, strategies)
- ✅ `ANTHROPIC_API_KEY` in Vercel-env (production + preview, set 2026-05-20-b)
- ✅ `DATABASE_URL_TEST` GitHub-secret active (set 2026-05-20-b)
- ⚠️ Eval-Set URLs in `docs/eval-set-phase-2.md` — User-Action pending (T-USER-4 from Bob's Tag-61-a report)
- ⚠️ AI Gateway Dashboard-Enable — strategic design-decision made (use Gateway), actual toggle pending

---

## File Structure (decomposition before tasks)

**CREATE (new files):**

```
src/lib/router/
  types.ts                         # RouteSignals, RouteContext, RouteDecision interfaces
  config.ts                        # env-driven config loader (ROUTER_TIER1_*, ROUTER_FREESHOT_*)
  signals.ts                       # decideTier() — Plugin-Signal pattern
  path.ts                          # decidePath() — Gateway vs Direct (Phase-2: always Gateway)
  budget.ts                        # Token-Budget + truncation
  index.ts                         # makeRouteDecision() composition + barrel export
  __tests__/
    config.test.ts
    signals.test.ts
    path.test.ts
    budget.test.ts
    integration.test.ts

src/db/schema/
  checks.ts                        # Drizzle Checks table schema
  check_results.ts                 # Drizzle CheckResults table schema

src/db/migrations/
  0001_checks_and_results.sql      # Drizzle-generated migration

src/lib/workflow/
  snake-oil-check.ts               # Vercel Workflow definition
  steps/
    scrape.ts                      # Step 1: scrape URL → cached HTML
    score.ts                       # Step 2: scorer + router + AI call
    persist.ts                     # Step 3: write to checks + check_results
  __tests__/
    integration.test.ts            # end-to-end workflow with mocked LLM

scripts/
  benchmark-strategies.ts          # Bob's §8 #1: single-call vs per-criterion on Sonnet
  benchmark-models.ts              # NEW Task 5b: Haiku vs Sonnet vs Gemini Flash
```

**MODIFY (existing files):**

```
src/lib/ai/gateway.ts              # Multi-Model refactor: accept provider + model_id params
src/lib/ai/__tests__/gateway.test.ts
src/lib/ai/strategies/single-call.ts   # use Router-Layer for model selection
src/lib/ai/strategies/per-criterion.ts  # same
src/lib/ai/__tests__/single-call.test.ts
src/lib/ai/__tests__/per-criterion.test.ts
package.json                       # add @ai-sdk/google
.env.example                       # add ROUTER_* env-vars
```

---

## Task 1: Setup — Dependencies + Env-Vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install @ai-sdk/google for Gemini Flash**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm install --save-exact @ai-sdk/google@1.0.0
```

Expected: package.json updated, lockfile bumped.

- [ ] **Step 2: Verify version pinning**

```bash
grep '"@ai-sdk/google"' package.json
```

Expected: `"@ai-sdk/google": "1.0.0"` (no `^` or `~`).

- [ ] **Step 3: Extend `.env.example` with Router-Vars**

Append to `.env.example`:

```bash

# --- Router Configuration (Phase-2-A Foundation) ---
# Tier-1 Standard (€1 Single-Shot, default Haiku)
ROUTER_TIER1_PROVIDER=anthropic
ROUTER_TIER1_MODEL=claude-haiku-4.5

# Tier-2 Deep (€3 Single-Shot, default Sonnet)
ROUTER_TIER2_PROVIDER=anthropic
ROUTER_TIER2_MODEL=claude-sonnet-4.5

# Free-Shot dedicated (Tier 0.5, always Gemini Flash)
ROUTER_FREESHOT_PROVIDER=google
ROUTER_FREESHOT_MODEL=gemini-3-flash

# Dev override: set all tiers to Gemini Flash for free dev
# ROUTER_TIER1_PROVIDER=google
# ROUTER_TIER1_MODEL=gemini-3-flash
# ROUTER_TIER2_PROVIDER=google
# ROUTER_TIER2_MODEL=gemini-3-flash

# Google API Key — for local dev with @ai-sdk/google direct
# Production reads from Vercel-AI-Gateway with OIDC (no key needed)
GOOGLE_GENERATIVE_AI_API_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "feat(deps): add @ai-sdk/google + Router env-var template"
```

---

## Task 2: Router Types

**Files:**
- Create: `src/lib/router/types.ts`
- Test: (no test file — types are compile-time-only)

- [ ] **Step 1: Write types.ts**

```typescript
// src/lib/router/types.ts

/**
 * Input signals to the Router-Layer.
 * Plugin-Signal-Pattern: Phase-2 implements customer_explicit_deep_analysis + stake_indicator.
 * Phase-3 adds domain_classifier_label + tier1_confidence.
 */
export interface RouteSignals {
  customer_explicit_deep_analysis?: boolean
  stake_indicator?: 'low' | 'medium' | 'high'
  // Phase-3 stubs (slot reserved):
  domain_classifier_label?: string
  tier1_confidence?: number
}

/**
 * Request context — who's asking and what tier they're on.
 */
export interface RouteContext {
  tier: 'free-shot' | 'standard' | 'deep' | 'sub-no-byok' | 'sub-byok'
  customer_id?: string
  // Phase-3+ only — BYOK config from DB
  byok_config?: BYOKConfig
}

/**
 * Phase-3 stub. Defined now for type-completeness.
 */
export interface BYOKConfig {
  provider: 'anthropic' | 'openai' | 'google'
  model_id: string
  encrypted_key: string
}

/**
 * Router output — what the workflow should execute.
 */
export interface RouteDecision {
  model_tier: 1 | 2
  provider: 'anthropic' | 'openai' | 'google'
  model_id: string
  key_source: 'shared' | 'byok'
  path: 'gateway' | 'direct'
  token_budget: TokenBudget
  gateway_tags?: string[]
}

export interface TokenBudget {
  input_max: number
  output_max: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/router/types.ts
git commit -m "feat(router): add type definitions for Router-Layer"
```

---

## Task 3: Router Config Loader (TDD)

**Files:**
- Create: `src/lib/router/config.ts`
- Test: `src/lib/router/__tests__/config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/router/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadRouterConfig } from '../config'

describe('Router Config Loader', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('loads tier-1 config from env vars', () => {
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5'
    
    const config = loadRouterConfig()
    
    expect(config.tier1).toEqual({
      provider: 'anthropic',
      model_id: 'claude-haiku-4.5',
    })
  })

  it('loads tier-2 config from env vars', () => {
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5'
    
    const config = loadRouterConfig()
    
    expect(config.tier2).toEqual({
      provider: 'anthropic',
      model_id: 'claude-sonnet-4.5',
    })
  })

  it('loads free-shot config from env vars', () => {
    process.env.ROUTER_FREESHOT_PROVIDER = 'google'
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash'
    
    const config = loadRouterConfig()
    
    expect(config.freeshot).toEqual({
      provider: 'google',
      model_id: 'gemini-3-flash',
    })
  })

  it('throws if required env var missing', () => {
    delete process.env.ROUTER_TIER1_PROVIDER
    
    expect(() => loadRouterConfig()).toThrow(/ROUTER_TIER1_PROVIDER/)
  })

  it('throws if provider value is invalid', () => {
    process.env.ROUTER_TIER1_PROVIDER = 'invalid-provider'
    process.env.ROUTER_TIER1_MODEL = 'whatever'
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5'
    process.env.ROUTER_FREESHOT_PROVIDER = 'google'
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash'
    
    expect(() => loadRouterConfig()).toThrow(/invalid provider/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/config.test.ts
```

Expected: FAIL with module-not-found error for `../config`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/router/config.ts
const VALID_PROVIDERS = ['anthropic', 'openai', 'google'] as const
type Provider = (typeof VALID_PROVIDERS)[number]

interface ModelConfig {
  provider: Provider
  model_id: string
}

interface RouterConfig {
  tier1: ModelConfig
  tier2: ModelConfig
  freeshot: ModelConfig
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function parseProvider(value: string, context: string): Provider {
  if (!VALID_PROVIDERS.includes(value as Provider)) {
    throw new Error(`Invalid provider "${value}" for ${context}. Must be one of: ${VALID_PROVIDERS.join(', ')}`)
  }
  return value as Provider
}

export function loadRouterConfig(): RouterConfig {
  const tier1Provider = parseProvider(requireEnv('ROUTER_TIER1_PROVIDER'), 'TIER1')
  const tier1Model = requireEnv('ROUTER_TIER1_MODEL')
  const tier2Provider = parseProvider(requireEnv('ROUTER_TIER2_PROVIDER'), 'TIER2')
  const tier2Model = requireEnv('ROUTER_TIER2_MODEL')
  const freeshotProvider = parseProvider(requireEnv('ROUTER_FREESHOT_PROVIDER'), 'FREESHOT')
  const freeshotModel = requireEnv('ROUTER_FREESHOT_MODEL')

  return {
    tier1: { provider: tier1Provider, model_id: tier1Model },
    tier2: { provider: tier2Provider, model_id: tier2Model },
    freeshot: { provider: freeshotProvider, model_id: freeshotModel },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/config.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router/config.ts src/lib/router/__tests__/config.test.ts
git commit -m "feat(router): add env-driven config loader with validation"
```

---

## Task 4: Router Signals (Tier-Selection)

**Files:**
- Create: `src/lib/router/signals.ts`
- Test: `src/lib/router/__tests__/signals.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/router/__tests__/signals.test.ts
import { describe, it, expect } from 'vitest'
import { decideTier } from '../signals'
import type { RouteSignals } from '../types'

describe('decideTier', () => {
  it('returns 1 by default (no signals)', () => {
    expect(decideTier({})).toBe(1)
  })

  it('returns 2 when customer_explicit_deep_analysis is true', () => {
    expect(decideTier({ customer_explicit_deep_analysis: true })).toBe(2)
  })

  it('returns 1 when customer_explicit_deep_analysis is false', () => {
    expect(decideTier({ customer_explicit_deep_analysis: false })).toBe(1)
  })

  it('returns 2 when stake_indicator is high', () => {
    expect(decideTier({ stake_indicator: 'high' })).toBe(2)
  })

  it('returns 1 when stake_indicator is medium', () => {
    expect(decideTier({ stake_indicator: 'medium' })).toBe(1)
  })

  it('returns 1 when stake_indicator is low', () => {
    expect(decideTier({ stake_indicator: 'low' })).toBe(1)
  })

  it('returns 2 when both signals trigger (toggle + high-stake)', () => {
    expect(decideTier({ 
      customer_explicit_deep_analysis: true, 
      stake_indicator: 'high' 
    })).toBe(2)
  })

  it('returns 2 if toggle is true even with low stake', () => {
    expect(decideTier({ 
      customer_explicit_deep_analysis: true, 
      stake_indicator: 'low' 
    })).toBe(2)
  })

  it('ignores Phase-3 stub signals (domain_classifier_label)', () => {
    // Phase-3 slot reserved but not active in MVP
    expect(decideTier({ 
      domain_classifier_label: 'medical-claims' 
    })).toBe(1)
  })

  it('ignores Phase-3 stub signals (tier1_confidence)', () => {
    expect(decideTier({ 
      tier1_confidence: 0.3 
    })).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/signals.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/router/signals.ts
import type { RouteSignals } from './types'

/**
 * Plugin-Signal Tier-Selection.
 * 
 * Phase-2 MVP: Implements Trigger B (Customer-Toggle) + Trigger D (Stake-Slider).
 * Phase-3 stubs (commented): Trigger A (Confidence) + Trigger C (Domain-Classifier).
 * 
 * Returns 1 (Tier-1 Standard) by default. Returns 2 (Tier-2 Deep) when any
 * active trigger fires. Phase-3 stubs are slot-reserved but inactive.
 */
export function decideTier(signals: RouteSignals): 1 | 2 {
  // Trigger B — Customer explicitly requests Deep-Analysis
  if (signals.customer_explicit_deep_analysis === true) return 2
  
  // Trigger D — Stake-Slider at high level
  if (signals.stake_indicator === 'high') return 2
  
  // Phase-3 stubs (slot reserved, currently inactive):
  // Trigger C — Domain-Classifier
  // if (signals.domain_classifier_label === 'medical-claims') return 2
  // if (signals.domain_classifier_label === 'financial-claims') return 2
  
  // Trigger A — Tier-1 confidence post-first-call (escalation)
  // if (signals.tier1_confidence != null && signals.tier1_confidence < 0.5) return 2
  
  return 1
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/signals.test.ts
```

Expected: 10/10 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router/signals.ts src/lib/router/__tests__/signals.test.ts
git commit -m "feat(router): add tier-selection signal-processing (B+D triggers)"
```

---

## Task 5: Router Path (Gateway vs Direct)

**Files:**
- Create: `src/lib/router/path.ts`
- Test: `src/lib/router/__tests__/path.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/router/__tests__/path.test.ts
import { describe, it, expect } from 'vitest'
import { decidePath } from '../path'
import type { RouteContext } from '../types'

describe('decidePath', () => {
  it('returns gateway for anonymous free-shot', () => {
    const ctx: RouteContext = { tier: 'free-shot' }
    expect(decidePath(ctx)).toBe('gateway')
  })

  it('returns gateway for anonymous standard single-shot', () => {
    const ctx: RouteContext = { tier: 'standard' }
    expect(decidePath(ctx)).toBe('gateway')
  })

  it('returns gateway for anonymous deep single-shot', () => {
    const ctx: RouteContext = { tier: 'deep' }
    expect(decidePath(ctx)).toBe('gateway')
  })

  it('returns gateway for sub-no-byok', () => {
    const ctx: RouteContext = { tier: 'sub-no-byok', customer_id: 'user_123' }
    expect(decidePath(ctx)).toBe('gateway')
  })

  it('returns direct for sub-byok (Phase-3+)', () => {
    const ctx: RouteContext = {
      tier: 'sub-byok',
      customer_id: 'user_123',
      byok_config: {
        provider: 'anthropic',
        model_id: 'claude-opus-4.6',
        encrypted_key: 'encrypted-blob',
      },
    }
    expect(decidePath(ctx)).toBe('direct')
  })

  it('returns gateway for sub-byok tier WITHOUT byok_config (edge case)', () => {
    // Defensive: if tier is sub-byok but no config, fall back to gateway (don't crash)
    const ctx: RouteContext = { tier: 'sub-byok', customer_id: 'user_123' }
    expect(decidePath(ctx)).toBe('gateway')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/path.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/router/path.ts
import type { RouteContext } from './types'

/**
 * Path-Selection: Gateway (shared keys) vs Direct (BYOK customer keys).
 * 
 * Phase-2 MVP: always 'gateway'. BYOK direct-path is Phase-3+.
 * 
 * Defensive: if tier is 'sub-byok' but byok_config is missing, fall back
 * to 'gateway' to prevent crashes (config-load-failure edge case).
 */
export function decidePath(context: RouteContext): 'gateway' | 'direct' {
  if (context.byok_config != null) {
    return 'direct'
  }
  return 'gateway'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/path.test.ts
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router/path.ts src/lib/router/__tests__/path.test.ts
git commit -m "feat(router): add Gateway-vs-Direct path-selection (Phase-2: always Gateway)"
```

---

## Task 6: Router Budget (Token-Limit + Truncation)

**Files:**
- Create: `src/lib/router/budget.ts`
- Test: `src/lib/router/__tests__/budget.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/router/__tests__/budget.test.ts
import { describe, it, expect } from 'vitest'
import { getTokenBudget, estimateTokens, truncateToTokens, checkBudget } from '../budget'

describe('getTokenBudget', () => {
  it('returns free-shot budget (tight)', () => {
    expect(getTokenBudget('free-shot')).toEqual({
      input_max: 10_000,
      output_max: 1_500,
    })
  })

  it('returns tier-1 budget (standard)', () => {
    expect(getTokenBudget('standard')).toEqual({
      input_max: 30_000,
      output_max: 3_000,
    })
  })

  it('returns tier-2 budget (deep)', () => {
    expect(getTokenBudget('deep')).toEqual({
      input_max: 50_000,
      output_max: 5_000,
    })
  })

  it('throws for unknown tier', () => {
    // @ts-expect-error testing runtime error
    expect(() => getTokenBudget('unknown')).toThrow(/unknown tier/i)
  })
})

describe('estimateTokens', () => {
  it('estimates ~1 token per 4 chars', () => {
    expect(estimateTokens('hello world')).toBe(3)  // 11 chars / 4 = 2.75 → ceil = 3
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('handles large input', () => {
    const text = 'a'.repeat(40_000)
    expect(estimateTokens(text)).toBe(10_000)
  })
})

describe('truncateToTokens', () => {
  it('returns input unchanged if within budget', () => {
    const input = 'hello world'
    expect(truncateToTokens(input, 100)).toBe(input)
  })

  it('truncates to roughly max_tokens × 4 chars', () => {
    const input = 'a'.repeat(1000)
    const result = truncateToTokens(input, 100)
    expect(result.length).toBeLessThanOrEqual(400)
  })

  it('handles empty input', () => {
    expect(truncateToTokens('', 100)).toBe('')
  })
})

describe('checkBudget', () => {
  it('returns ok with original content when within budget', () => {
    const content = 'a'.repeat(1000)  // ~250 tokens
    const result = checkBudget(content, 'standard')
    expect(result.ok).toBe(true)
    expect(result.truncated_content).toBe(content)
    expect(result.warning).toBeUndefined()
  })

  it('returns ok with truncated content + warning when over budget', () => {
    const content = 'a'.repeat(200_000)  // 50K tokens, well over 30K tier-1
    const result = checkBudget(content, 'standard')
    expect(result.ok).toBe(true)
    expect(result.truncated_content.length).toBeLessThanOrEqual(120_000)  // 30K * 4
    expect(result.warning).toMatch(/truncated/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/budget.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/router/budget.ts
import type { TokenBudget } from './types'

const TOKEN_BUDGETS: Record<string, TokenBudget> = {
  'free-shot': { input_max: 10_000, output_max: 1_500 },
  'standard':  { input_max: 30_000, output_max: 3_000 },
  'deep':      { input_max: 50_000, output_max: 5_000 },
}

export function getTokenBudget(tier: string): TokenBudget {
  const budget = TOKEN_BUDGETS[tier]
  if (!budget) {
    throw new Error(`Unknown tier "${tier}". Valid: ${Object.keys(TOKEN_BUDGETS).join(', ')}`)
  }
  return budget
}

/**
 * Rough token-count estimate: ~1 token per 4 chars (English heuristic).
 * Accurate enough for budget-guards; not a substitute for real tokenizer counts.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function truncateToTokens(text: string, max_tokens: number): string {
  const max_chars = max_tokens * 4
  if (text.length <= max_chars) return text
  return text.slice(0, max_chars)
}

interface BudgetCheckResult {
  ok: boolean
  truncated_content: string
  warning?: string
}

export function checkBudget(content: string, tier: 'free-shot' | 'standard' | 'deep'): BudgetCheckResult {
  const budget = getTokenBudget(tier)
  const estimated = estimateTokens(content)
  
  if (estimated <= budget.input_max) {
    return { ok: true, truncated_content: content }
  }
  
  const truncated = truncateToTokens(content, budget.input_max)
  return {
    ok: true,
    truncated_content: truncated,
    warning: `Content was ${estimated} tokens, truncated to ${budget.input_max} for ${tier} analysis.`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/budget.test.ts
```

Expected: 11/11 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/router/budget.ts src/lib/router/__tests__/budget.test.ts
git commit -m "feat(router): add token-budget per tier + truncation guard"
```

---

## Task 7: Router Composition (index.ts + integration)

**Files:**
- Create: `src/lib/router/index.ts`
- Test: `src/lib/router/__tests__/integration.test.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
// src/lib/router/__tests__/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeRouteDecision } from '../index'
import type { RouteSignals, RouteContext } from '../types'

describe('makeRouteDecision (integration)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5'
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5'
    process.env.ROUTER_FREESHOT_PROVIDER = 'google'
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('routes free-shot to gemini flash via gateway', () => {
    const signals: RouteSignals = {}
    const context: RouteContext = { tier: 'free-shot' }
    
    const decision = makeRouteDecision(signals, context)
    
    expect(decision).toMatchObject({
      provider: 'google',
      model_id: 'gemini-3-flash',
      path: 'gateway',
      key_source: 'shared',
      token_budget: { input_max: 10_000, output_max: 1_500 },
    })
  })

  it('routes standard tier-1 to haiku via gateway', () => {
    const signals: RouteSignals = {}
    const context: RouteContext = { tier: 'standard' }
    
    const decision = makeRouteDecision(signals, context)
    
    expect(decision).toMatchObject({
      model_tier: 1,
      provider: 'anthropic',
      model_id: 'claude-haiku-4.5',
      path: 'gateway',
      token_budget: { input_max: 30_000, output_max: 3_000 },
    })
  })

  it('routes deep tier-2 to sonnet via gateway', () => {
    const signals: RouteSignals = { customer_explicit_deep_analysis: true }
    const context: RouteContext = { tier: 'deep' }
    
    const decision = makeRouteDecision(signals, context)
    
    expect(decision).toMatchObject({
      model_tier: 2,
      provider: 'anthropic',
      model_id: 'claude-sonnet-4.5',
      path: 'gateway',
      token_budget: { input_max: 50_000, output_max: 5_000 },
    })
  })

  it('escalates standard to tier-2 on high stake', () => {
    const signals: RouteSignals = { stake_indicator: 'high' }
    const context: RouteContext = { tier: 'standard' }
    
    const decision = makeRouteDecision(signals, context)
    
    expect(decision.model_tier).toBe(2)
    expect(decision.model_id).toBe('claude-sonnet-4.5')
  })

  it('includes gateway_tags for cost-tracking', () => {
    const decision = makeRouteDecision({}, { tier: 'standard' })
    
    expect(decision.gateway_tags).toContain('tier:standard')
    expect(decision.gateway_tags).toContain('feature:snake-oil-check')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/integration.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write composition**

```typescript
// src/lib/router/index.ts
import { loadRouterConfig } from './config'
import { decideTier } from './signals'
import { decidePath } from './path'
import { getTokenBudget } from './budget'
import type { RouteSignals, RouteContext, RouteDecision } from './types'

export * from './types'
export { loadRouterConfig } from './config'
export { decideTier } from './signals'
export { decidePath } from './path'
export { getTokenBudget, estimateTokens, truncateToTokens, checkBudget } from './budget'

/**
 * Main entry-point: take signals + context, return decision.
 * 
 * Composition: tier-selection → path-selection → model+provider lookup
 *              from env-config → budget per tier → gateway-tags.
 */
export function makeRouteDecision(
  signals: RouteSignals,
  context: RouteContext
): RouteDecision {
  const config = loadRouterConfig()
  
  // Free-shot is special: always uses freeshot config, never escalates
  if (context.tier === 'free-shot') {
    return {
      model_tier: 1,
      provider: config.freeshot.provider,
      model_id: config.freeshot.model_id,
      key_source: 'shared',
      path: 'gateway',
      token_budget: getTokenBudget('free-shot'),
      gateway_tags: [
        'feature:snake-oil-check',
        'tier:free-shot',
      ],
    }
  }
  
  // Paid tiers: signals decide tier-1 vs tier-2
  const tier = decideTier(signals)
  const path = decidePath(context)
  const modelConfig = tier === 1 ? config.tier1 : config.tier2
  const budget_tier = tier === 1 ? 'standard' : 'deep'
  
  return {
    model_tier: tier,
    provider: modelConfig.provider,
    model_id: modelConfig.model_id,
    key_source: context.byok_config ? 'byok' : 'shared',
    path,
    token_budget: getTokenBudget(budget_tier),
    gateway_tags: [
      'feature:snake-oil-check',
      `tier:${context.tier}`,
      `model_tier:${tier}`,
    ],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/__tests__/integration.test.ts
```

Expected: 5/5 PASS.

- [ ] **Step 5: Verify all router tests still pass**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/router/
```

Expected: ALL router tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/router/index.ts src/lib/router/__tests__/integration.test.ts
git commit -m "feat(router): add makeRouteDecision composition + integration tests"
```

---

## Task 8: Gateway.ts Multi-Model Refactor

**Files:**
- Modify: `src/lib/ai/gateway.ts`
- Modify: `src/lib/ai/__tests__/gateway.test.ts` (existing tests must keep passing)

- [ ] **Step 1: Read current gateway.ts to understand baseline**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && cat src/lib/ai/gateway.ts
```

Expected: see single-model Sonnet 4.5 setup from Bob's Task 4.

- [ ] **Step 2: Write failing test for multi-model**

Append to `src/lib/ai/__tests__/gateway.test.ts`:

```typescript
// inside the existing describe block:
it('createModelHandle accepts provider + model_id and returns @ai-sdk client', () => {
  const handle = createModelHandle({ provider: 'anthropic', model_id: 'claude-haiku-4.5' })
  expect(handle).toBeDefined()
  // We don't introspect the @ai-sdk internals here; integration tests via strategies verify actual usage
})

it('createModelHandle works for google provider', () => {
  const handle = createModelHandle({ provider: 'google', model_id: 'gemini-3-flash' })
  expect(handle).toBeDefined()
})

it('createModelHandle throws for unsupported provider', () => {
  // @ts-expect-error testing runtime error
  expect(() => createModelHandle({ provider: 'unsupported', model_id: 'x' })).toThrow()
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/ai/__tests__/gateway.test.ts
```

Expected: 3 tests FAIL with `createModelHandle is not exported` or similar.

- [ ] **Step 4: Refactor gateway.ts to multi-model**

Rewrite `src/lib/ai/gateway.ts`:

```typescript
// src/lib/ai/gateway.ts
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

export interface ModelHandleSpec {
  provider: 'anthropic' | 'openai' | 'google'
  model_id: string
}

/**
 * Multi-Model Gateway-Routed Handle.
 * 
 * Phase-2: All providers go through Vercel AI Gateway via @ai-sdk packages.
 * Gateway intercepts when VERCEL_OIDC_TOKEN is auto-injected in runtime.
 * Locally, calls go direct to provider via ANTHROPIC_API_KEY / 
 * GOOGLE_GENERATIVE_AI_API_KEY env vars.
 * 
 * Phase-3+: For BYOK customers, create handle with customer's decrypted key.
 * Pattern: customer-key in env or passed via @ai-sdk provider options.
 */
export function createModelHandle(spec: ModelHandleSpec) {
  switch (spec.provider) {
    case 'anthropic':
      return anthropic(spec.model_id)
    case 'google':
      return google(spec.model_id)
    case 'openai':
      // Future: import { openai } from '@ai-sdk/openai' once added
      throw new Error('OpenAI provider not yet integrated. Add @ai-sdk/openai dep first.')
    default:
      throw new Error(`Unknown provider: ${spec.provider as string}`)
  }
}

// Legacy single-model handle, kept for backward-compat with strategies until they migrate
// Will be removed in Task 9 when strategies use Router-Layer
export const legacyAnthropicHandle = anthropic('claude-sonnet-4.5')
```

- [ ] **Step 5: Run test to verify multi-model passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/ai/__tests__/gateway.test.ts
```

Expected: all gateway tests PASS (existing + new 3).

- [ ] **Step 6: Verify tsc still clean**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/gateway.ts src/lib/ai/__tests__/gateway.test.ts
git commit -m "refactor(gateway): support multi-model via provider + model_id params"
```

---

## Task 9: Strategy Integration with Router

**Files:**
- Modify: `src/lib/ai/strategies/single-call.ts`
- Modify: `src/lib/ai/strategies/per-criterion.ts`
- Modify: `src/lib/ai/__tests__/single-call.test.ts`
- Modify: `src/lib/ai/__tests__/per-criterion.test.ts`

- [ ] **Step 1: Read current single-call.ts**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && cat src/lib/ai/strategies/single-call.ts
```

Identify: where does the model get used? (Bob's code uses `legacyAnthropicHandle` or similar — refactor it to accept a `RouteDecision`.)

- [ ] **Step 2: Update single-call.ts to take RouteDecision**

```typescript
// src/lib/ai/strategies/single-call.ts (refactor — actual content depends on Bob's original)
import { generateObject } from 'ai'
import { createModelHandle } from '../gateway'
import type { RouteDecision } from '../../router/types'
import { FullCheckSchema } from '../../scoring/schema'
import { buildSingleCallPrompt } from '../prompts'

interface SingleCallInput {
  scrapedContent: string
  routeDecision: RouteDecision
}

export async function runSingleCallStrategy(input: SingleCallInput) {
  const handle = createModelHandle({
    provider: input.routeDecision.provider,
    model_id: input.routeDecision.model_id,
  })
  
  const prompt = buildSingleCallPrompt(input.scrapedContent)
  
  const result = await generateObject({
    model: handle,
    schema: FullCheckSchema,
    prompt,
    providerOptions: {
      gateway: {
        tags: input.routeDecision.gateway_tags ?? [],
      },
    },
  })
  
  return {
    full_check: result.object,
    usage: result.usage,
  }
}
```

- [ ] **Step 3: Update single-call.test.ts to mock router**

Add to existing tests:

```typescript
import type { RouteDecision } from '../../router/types'

const mockRouteDecision: RouteDecision = {
  model_tier: 1,
  provider: 'anthropic',
  model_id: 'claude-haiku-4.5',
  key_source: 'shared',
  path: 'gateway',
  token_budget: { input_max: 30_000, output_max: 3_000 },
  gateway_tags: ['feature:snake-oil-check', 'tier:standard'],
}

// inside existing it() blocks, pass routeDecision: mockRouteDecision
```

- [ ] **Step 4: Same refactor for per-criterion.ts**

Apply same pattern: function accepts `routeDecision: RouteDecision`, creates handle via `createModelHandle`, passes through.

- [ ] **Step 5: Run all strategy tests**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/ai/
```

Expected: ALL PASS (single-call + per-criterion + gateway).

- [ ] **Step 6: Verify integration via full vitest run**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm test
```

Expected: previously 45/45 tests + new Router tests (~30 added) = ~75+ PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/strategies/ src/lib/ai/__tests__/
git commit -m "refactor(ai): strategies use Router-Layer for model selection"
```

---

## Task 10: DB Migration — Checks + Check_Results Tables

**Files:**
- Create: `src/db/schema/checks.ts`
- Create: `src/db/schema/check_results.ts`
- Modify: `src/db/schema/index.ts` (export new schemas)
- Create: `src/db/migrations/0001_checks_and_results.sql` (Drizzle-generated)

- [ ] **Step 1: Write Checks schema**

```typescript
// src/db/schema/checks.ts
import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const tierEnum = pgEnum('check_tier', [
  'free-shot',
  'standard',
  'deep',
  'example',
])

export const stakeIndicatorEnum = pgEnum('stake_indicator', ['low', 'medium', 'high'])
export const paymentStatusEnum = pgEnum('payment_status', [
  'not-required',
  'pending',
  'paid',
  'failed',
  'refunded',
])
export const scrapeStatusEnum = pgEnum('scrape_status', ['pending', 'done', 'failed'])
export const workflowStatusEnum = pgEnum('workflow_status', ['pending', 'running', 'done', 'failed'])

export const checks = pgTable('checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  result_token: uuid('result_token').notNull().unique().defaultRandom(),
  url: text('url').notNull(),
  url_normalized: text('url_normalized').notNull(),
  tier: tierEnum('tier').notNull(),
  stake_indicator: stakeIndicatorEnum('stake_indicator'),
  deep_analysis_requested: boolean('deep_analysis_requested').notNull().default(false),
  payment_status: paymentStatusEnum('payment_status').notNull().default('not-required'),
  stripe_payment_intent_id: text('stripe_payment_intent_id'),
  payment_intent_amount_cents: integer('payment_intent_amount_cents'),
  scrape_status: scrapeStatusEnum('scrape_status').notNull().default('pending'),
  scrape_html_blob_url: text('scrape_html_blob_url'),
  workflow_status: workflowStatusEnum('workflow_status').notNull().default('pending'),
  workflow_error: text('workflow_error'),
  model_provider: text('model_provider'),
  model_id: text('model_id'),
  token_budget_used_input: integer('token_budget_used_input'),
  token_budget_used_output: integer('token_budget_used_output'),
  llm_cost_eur_cents: integer('llm_cost_eur_cents'),
  is_curated_example: boolean('is_curated_example').notNull().default(false),
  example_slug: text('example_slug'),
  ip_hash: text('ip_hash'),
  cookie_session: text('cookie_session'),
  email_subscriber_id: uuid('email_subscriber_id'),  // FK populated Phase-2-B
  created_at: timestamp('created_at').notNull().defaultNow(),
  expires_at: timestamp('expires_at'),
})
```

- [ ] **Step 2: Write CheckResults schema**

```typescript
// src/db/schema/check_results.ts
import { pgTable, uuid, integer, boolean, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'
import { checks } from './checks'

export const tendencyEnum = pgEnum('tendency', ['green', 'amber', 'red'])

export const check_results = pgTable('check_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  check_id: uuid('check_id').notNull().references(() => checks.id, { onDelete: 'cascade' }),
  criteria_scored: integer('criteria_scored').notNull(),
  total_score: integer('total_score').notNull(),
  tendency: tendencyEnum('tendency').notNull(),
  criteria_scores: jsonb('criteria_scores').notNull(),  // [{criterion_id, score, reasoning, evidence_quote}]
  warning_truncated: boolean('warning_truncated').notNull().default(false),
  raw_llm_response: jsonb('raw_llm_response'),  // debug, purgeable
  created_at: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 3: Update schema index**

```typescript
// src/db/schema/index.ts
export * from './checks'
export * from './check_results'
// existing exports from Phase-1 remain
```

- [ ] **Step 4: Generate migration**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm drizzle-kit generate
```

Expected: new file in `src/db/migrations/` named `0001_<descriptor>.sql`.

- [ ] **Step 5: Review generated migration**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && cat src/db/migrations/0001_*.sql
```

Sanity-check: tables + indexes + foreign-keys present.

- [ ] **Step 6: Apply migration to local dev DB**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm drizzle-kit migrate
```

Expected: migration applied successfully.

- [ ] **Step 7: Write schema-existence test**

```typescript
// src/db/__tests__/schema.test.ts
import { describe, it, expect } from 'vitest'
import { checks, check_results } from '../schema'

describe('Phase-2 Schema', () => {
  it('checks table has required columns', () => {
    expect(checks.id).toBeDefined()
    expect(checks.result_token).toBeDefined()
    expect(checks.tier).toBeDefined()
    expect(checks.payment_status).toBeDefined()
    expect(checks.workflow_status).toBeDefined()
  })

  it('check_results table has check_id FK', () => {
    expect(check_results.check_id).toBeDefined()
    expect(check_results.criteria_scored).toBeDefined()
    expect(check_results.total_score).toBeDefined()
    expect(check_results.tendency).toBeDefined()
  })
})
```

- [ ] **Step 8: Run test**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/db/__tests__/schema.test.ts
```

Expected: 2/2 PASS.

- [ ] **Step 9: Commit**

```bash
git add src/db/schema/ src/db/migrations/ src/db/__tests__/schema.test.ts
git commit -m "feat(db): add checks + check_results tables with Phase-2 schema"
```

---

## Task 11: Vercel Workflow — Skeleton + Scrape Step

**Files:**
- Create: `src/lib/workflow/snake-oil-check.ts`
- Create: `src/lib/workflow/steps/scrape.ts`
- Test: `src/lib/workflow/__tests__/scrape.test.ts`

- [ ] **Step 1: Write failing test for scrape step**

```typescript
// src/lib/workflow/__tests__/scrape.test.ts
import { describe, it, expect, vi } from 'vitest'
import { scrapeStep } from '../steps/scrape'

vi.mock('../../scraping', () => ({
  fetchHtml: vi.fn().mockResolvedValue('<html><body>fake page</body></html>'),
  normalizeHtml: vi.fn().mockReturnValue('fake page'),
}))

describe('scrapeStep', () => {
  it('returns normalized content + blob URL placeholder', async () => {
    const result = await scrapeStep({ url: 'https://example.com' })
    
    expect(result).toMatchObject({
      url: 'https://example.com',
      normalized_content: 'fake page',
      raw_html_size: expect.any(Number),
    })
  })

  it('handles fetch errors gracefully', async () => {
    const { fetchHtml } = await import('../../scraping')
    vi.mocked(fetchHtml).mockRejectedValueOnce(new Error('Network error'))
    
    await expect(scrapeStep({ url: 'https://bad.example.com' })).rejects.toThrow(/Network error/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/workflow/__tests__/scrape.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write scrape step**

```typescript
// src/lib/workflow/steps/scrape.ts
import { fetchHtml, normalizeHtml } from '../../scraping'

export interface ScrapeStepInput {
  url: string
}

export interface ScrapeStepOutput {
  url: string
  normalized_content: string
  raw_html_size: number
  // blob_url to be added in later task when Vercel Blob integration goes live
}

export async function scrapeStep(input: ScrapeStepInput): Promise<ScrapeStepOutput> {
  const html = await fetchHtml(input.url)
  const normalized = normalizeHtml(html)
  
  return {
    url: input.url,
    normalized_content: normalized,
    raw_html_size: html.length,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/workflow/__tests__/scrape.test.ts
```

Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workflow/steps/scrape.ts src/lib/workflow/__tests__/scrape.test.ts
git commit -m "feat(workflow): add scrape step wrapping existing scraping module"
```

---

## Task 12: Workflow Score Step + Persist Step + Definition

**Files:**
- Create: `src/lib/workflow/steps/score.ts`
- Create: `src/lib/workflow/steps/persist.ts`
- Create: `src/lib/workflow/snake-oil-check.ts`
- Test: `src/lib/workflow/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test (full workflow)**

```typescript
// src/lib/workflow/__tests__/integration.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { runSnakeOilCheckWorkflow } from '../snake-oil-check'

// Mock all external dependencies
vi.mock('../../scraping', () => ({
  fetchHtml: vi.fn().mockResolvedValue('<html><body>coaching offer page</body></html>'),
  normalizeHtml: vi.fn().mockReturnValue('coaching offer page content'),
}))

vi.mock('../../ai/strategies/single-call', () => ({
  runSingleCallStrategy: vi.fn().mockResolvedValue({
    full_check: {
      criteria_scores: [
        { criterion_id: 1, score: 7, reasoning: 'clear claims', evidence_quote: '...' },
        // ... 11 more for full check
      ],
    },
    usage: { input_tokens: 5000, output_tokens: 500 },
  }),
}))

vi.mock('../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'mock-check-id', result_token: 'mock-token' }]) }) }),
  },
}))

describe('SnakeOilCheckWorkflow (integration)', () => {
  beforeAll(() => {
    process.env.ROUTER_TIER1_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER1_MODEL = 'claude-haiku-4.5'
    process.env.ROUTER_TIER2_PROVIDER = 'anthropic'
    process.env.ROUTER_TIER2_MODEL = 'claude-sonnet-4.5'
    process.env.ROUTER_FREESHOT_PROVIDER = 'google'
    process.env.ROUTER_FREESHOT_MODEL = 'gemini-3-flash'
  })

  it('runs end-to-end for standard tier', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'standard',
      signals: {},
    })
    
    expect(result.workflow_status).toBe('done')
    expect(result.result_token).toBe('mock-token')
  })

  it('runs end-to-end for free-shot tier', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'free-shot',
      signals: {},
    })
    
    expect(result.workflow_status).toBe('done')
  })

  it('runs end-to-end for deep tier with explicit deep flag', async () => {
    const result = await runSnakeOilCheckWorkflow({
      url: 'https://example.com',
      tier: 'deep',
      signals: { customer_explicit_deep_analysis: true },
    })
    
    expect(result.workflow_status).toBe('done')
  })
})
```

- [ ] **Step 2: Write score step**

```typescript
// src/lib/workflow/steps/score.ts
import { makeRouteDecision, checkBudget } from '../../router'
import { runSingleCallStrategy } from '../../ai/strategies/single-call'
import type { RouteSignals } from '../../router/types'

export interface ScoreStepInput {
  scraped_content: string
  tier: 'free-shot' | 'standard' | 'deep'
  signals: RouteSignals
}

export interface ScoreStepOutput {
  criteria_scored: number
  total_score: number
  tendency: 'green' | 'amber' | 'red'
  criteria_scores: Array<{
    criterion_id: number
    score: number
    reasoning: string
    evidence_quote: string
  }>
  warning_truncated: boolean
  model_provider: string
  model_id: string
  token_usage: { input: number; output: number }
}

export async function scoreStep(input: ScoreStepInput): Promise<ScoreStepOutput> {
  // Decide model + budget
  const decision = makeRouteDecision(input.signals, { tier: input.tier })
  
  // Apply budget-guard to content
  const budget_tier = input.tier === 'free-shot' ? 'free-shot' : 
                       input.tier === 'deep' ? 'deep' : 'standard'
  const budgetResult = checkBudget(input.scraped_content, budget_tier)
  
  // Run AI scoring (single-call strategy default per scoring-framework.md §4)
  const result = await runSingleCallStrategy({
    scrapedContent: budgetResult.truncated_content,
    routeDecision: decision,
  })
  
  // Compute tendency-bucket
  const total_score = result.full_check.criteria_scores.reduce((sum, c) => sum + c.score, 0)
  const tendency = total_score >= 75 ? 'green' : total_score >= 45 ? 'amber' : 'red'
  
  return {
    criteria_scored: result.full_check.criteria_scores.length,
    total_score,
    tendency,
    criteria_scores: result.full_check.criteria_scores,
    warning_truncated: budgetResult.warning != null,
    model_provider: decision.provider,
    model_id: decision.model_id,
    token_usage: {
      input: result.usage?.input_tokens ?? 0,
      output: result.usage?.output_tokens ?? 0,
    },
  }
}
```

- [ ] **Step 3: Write persist step**

```typescript
// src/lib/workflow/steps/persist.ts
import { db } from '../../db'
import { checks, check_results } from '../../db/schema'
import type { ScoreStepOutput } from './score'
import type { ScrapeStepOutput } from './scrape'

export interface PersistStepInput {
  url: string
  tier: 'free-shot' | 'standard' | 'deep'
  scrape: ScrapeStepOutput
  score: ScoreStepOutput
}

export interface PersistStepOutput {
  check_id: string
  result_token: string
}

export async function persistStep(input: PersistStepInput): Promise<PersistStepOutput> {
  // Normalize URL for de-dup (lower, strip trailing slash, sort query params)
  const url_normalized = new URL(input.url).toString().toLowerCase().replace(/\/$/, '')
  
  // Insert check row
  const [check] = await db
    .insert(checks)
    .values({
      url: input.url,
      url_normalized,
      tier: input.tier,
      payment_status: input.tier === 'free-shot' ? 'not-required' : 'paid',
      scrape_status: 'done',
      workflow_status: 'done',
      model_provider: input.score.model_provider,
      model_id: input.score.model_id,
      token_budget_used_input: input.score.token_usage.input,
      token_budget_used_output: input.score.token_usage.output,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // +30d
    })
    .returning()
  
  // Insert result row
  await db
    .insert(check_results)
    .values({
      check_id: check.id,
      criteria_scored: input.score.criteria_scored,
      total_score: input.score.total_score,
      tendency: input.score.tendency,
      criteria_scores: input.score.criteria_scores,
      warning_truncated: input.score.warning_truncated,
    })
  
  return {
    check_id: check.id,
    result_token: check.result_token,
  }
}
```

- [ ] **Step 4: Write workflow definition**

```typescript
// src/lib/workflow/snake-oil-check.ts
import { workflow } from '@vercel/workflow'
import { scrapeStep } from './steps/scrape'
import { scoreStep } from './steps/score'
import { persistStep } from './steps/persist'
import type { RouteSignals } from '../router/types'

export interface SnakeOilCheckInput {
  url: string
  tier: 'free-shot' | 'standard' | 'deep'
  signals: RouteSignals
}

export interface SnakeOilCheckOutput {
  workflow_status: 'done' | 'failed'
  check_id?: string
  result_token?: string
  error?: string
}

export const runSnakeOilCheckWorkflow = workflow({
  name: 'snake-oil-check',
  retry: { maxAttempts: 3 },
}, async (input: SnakeOilCheckInput): Promise<SnakeOilCheckOutput> => {
  try {
    // Step 1: Scrape
    const scrape = await scrapeStep({ url: input.url })
    
    // Step 2: Score (AI call via Router)
    const score = await scoreStep({
      scraped_content: scrape.normalized_content,
      tier: input.tier,
      signals: input.signals,
    })
    
    // Step 3: Persist
    const persist = await persistStep({
      url: input.url,
      tier: input.tier,
      scrape,
      score,
    })
    
    return {
      workflow_status: 'done',
      check_id: persist.check_id,
      result_token: persist.result_token,
    }
  } catch (err) {
    return {
      workflow_status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
})
```

- [ ] **Step 5: Run integration test**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm vitest run src/lib/workflow/__tests__/integration.test.ts
```

Expected: 3/3 PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm test
```

Expected: ~80+ tests PASS (all previous + Workflow).

- [ ] **Step 7: Commit**

```bash
git add src/lib/workflow/
git commit -m "feat(workflow): durable Vercel Workflow with scrape→score→persist steps"
```

---

## Task 13: Cross-Model-Benchmark Script (NEW Task 5b)

**Files:**
- Create: `scripts/benchmark-models.ts`
- Modify: `docs/eval-set-phase-2.md` (User populates 5 URLs before running)

- [ ] **Step 1: Verify eval-set is populated**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && cat docs/eval-set-phase-2.md
```

Expected: 5 URLs filled in (2 Gold + 2 Snake-Oil + 1 Ambiguous). If not, halt this task and surface to User as blocking dependency.

- [ ] **Step 2: Write benchmark script**

```typescript
// scripts/benchmark-models.ts
/**
 * Cross-Model-Benchmark (Phase-2 Task 5b, per design-doc 2026-05-20 Section 14.1).
 * 
 * Compares Haiku 4.5 vs Sonnet 4.5 vs Gemini Flash on the 5 Eval-URLs.
 * Output: per-URL scores from each model + aggregate disagreement stats.
 * 
 * Purpose: Validate that Haiku-4.5 is sufficient for the €1 Standard tier
 * (the design-doc's pricing assumption). If Haiku diverges significantly
 * from Sonnet on the same eval-URLs → re-price to Sonnet-Standard at €1.49+.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runSingleCallStrategy } from '../src/lib/ai/strategies/single-call'
import { makeRouteDecision } from '../src/lib/router'
import { fetchHtml, normalizeHtml } from '../src/lib/scraping'

interface EvalUrl {
  url: string
  expected_tendency: 'green' | 'amber' | 'red'
  category: 'gold' | 'snake-oil' | 'ambiguous'
  notes: string
}

function readEvalSet(): EvalUrl[] {
  const path = join(__dirname, '../docs/eval-set-phase-2.md')
  const content = readFileSync(path, 'utf-8')
  // Parser TODO: extract structured URLs from markdown
  // For now, expect a JSON code-block at the bottom of the file
  const match = content.match(/```json\n([\s\S]+?)\n```/)
  if (!match) {
    throw new Error('eval-set-phase-2.md must contain a JSON code-block with the eval URLs')
  }
  return JSON.parse(match[1])
}

const MODELS_TO_BENCHMARK = [
  { provider: 'google' as const, model_id: 'gemini-3-flash', label: 'Gemini Flash' },
  { provider: 'anthropic' as const, model_id: 'claude-haiku-4.5', label: 'Haiku 4.5' },
  { provider: 'anthropic' as const, model_id: 'claude-sonnet-4.5', label: 'Sonnet 4.5' },
]

async function runBenchmark() {
  const evalSet = readEvalSet()
  const results: Array<{
    url: string
    expected: string
    model: string
    score: number
    tendency: string
    cost_eur_cents: number
  }> = []

  for (const url of evalSet) {
    console.log(`\n=== ${url.url} (expected: ${url.expected_tendency}) ===`)
    
    const html = await fetchHtml(url.url)
    const content = normalizeHtml(html)
    
    for (const model of MODELS_TO_BENCHMARK) {
      console.log(`  → ${model.label}...`)
      
      const decision = makeRouteDecision({}, { tier: 'standard' })
      // Override decision for benchmark
      decision.provider = model.provider
      decision.model_id = model.model_id
      
      const start = Date.now()
      const result = await runSingleCallStrategy({
        scrapedContent: content,
        routeDecision: decision,
      })
      const elapsed = Date.now() - start
      
      const total_score = result.full_check.criteria_scores.reduce((s, c) => s + c.score, 0)
      const tendency = total_score >= 75 ? 'green' : total_score >= 45 ? 'amber' : 'red'
      
      // Rough cost estimate (cents)
      const costMap: Record<string, number> = {
        'gemini-3-flash': 0.2,
        'claude-haiku-4.5': 4.5,
        'claude-sonnet-4.5': 13.5,
      }
      const cost_eur_cents = costMap[model.model_id] ?? 0
      
      results.push({
        url: url.url,
        expected: url.expected_tendency,
        model: model.label,
        score: total_score,
        tendency,
        cost_eur_cents,
      })
      
      console.log(`     Score: ${total_score}, Tendency: ${tendency}, Time: ${elapsed}ms, Cost: ~€${cost_eur_cents / 100}`)
    }
  }
  
  // Summary table
  console.log('\n=== Summary ===')
  console.log('URL | Expected | Gemini | Haiku | Sonnet')
  for (const url of evalSet) {
    const row = results.filter(r => r.url === url.url)
    const gemini = row.find(r => r.model === 'Gemini Flash')
    const haiku = row.find(r => r.model === 'Haiku 4.5')
    const sonnet = row.find(r => r.model === 'Sonnet 4.5')
    console.log(`${url.url} | ${url.expected_tendency} | ${gemini?.tendency} (${gemini?.score}) | ${haiku?.tendency} (${haiku?.score}) | ${sonnet?.tendency} (${sonnet?.score})`)
  }
  
  // Disagreement stats
  console.log('\n=== Disagreement (Haiku vs Sonnet on 12-criteria scores) ===')
  // Per-criterion diff computed per URL — used to decide if Haiku-Standard is viable
  // (per design-doc Section 6.5 Empirical-Validation-Gate)
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Add npm script**

Update `package.json`:

```json
{
  "scripts": {
    "benchmark:models": "tsx scripts/benchmark-models.ts"
  }
}
```

- [ ] **Step 4: Verify script compiles**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Document run-instructions**

Append to `scripts/README.md` (create if needed):

```markdown
## benchmark-models

Run Cross-Model-Benchmark for Phase-2 Task 5b (per design-doc 2026-05-20).

Requires: eval-set-phase-2.md populated with 5 URLs + Anthropic + Google API keys in env.

\`\`\`bash
pnpm benchmark:models
\`\`\`

Cost per run: ~€0.50 (5 URLs × 3 models × per-call cost). Validates whether Haiku-4.5
sufficient for €1 Standard-Tier as designed.
\`\`\`

- [ ] **Step 6: Commit**

```bash
git add scripts/benchmark-models.ts package.json scripts/README.md
git commit -m "feat(scripts): add Cross-Model-Benchmark (Haiku vs Sonnet vs Gemini Flash)"
```

---

## Task 14: Strategy-Benchmark Script (Bob's §8 #1)

**Files:**
- Create: `scripts/benchmark-strategies.ts`

- [ ] **Step 1: Write benchmark script**

```typescript
// scripts/benchmark-strategies.ts
/**
 * Strategy-Benchmark (Bob's §8 #1, per existing Phase-2 plan-doc).
 * 
 * Compares single-call vs per-criterion strategies on Sonnet 4.5 across 5 Eval-URLs.
 * Falsification-design: if average per-criterion-score disagreement ≤ 5pt and 
 * weighted-total-disagreement ≤ 5pt → single-call wins (the prior).
 * If > 5pt average → STOP, investigate via evidence-quote spot-checks (do NOT auto-pick).
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runSingleCallStrategy } from '../src/lib/ai/strategies/single-call'
import { runPerCriterionStrategy } from '../src/lib/ai/strategies/per-criterion'
import { makeRouteDecision } from '../src/lib/router'
import { fetchHtml, normalizeHtml } from '../src/lib/scraping'

function readEvalSet() {
  const path = join(__dirname, '../docs/eval-set-phase-2.md')
  const content = readFileSync(path, 'utf-8')
  const match = content.match(/```json\n([\s\S]+?)\n```/)
  if (!match) throw new Error('eval-set-phase-2.md must contain JSON code-block')
  return JSON.parse(match[1])
}

async function runBenchmark() {
  const evalSet = readEvalSet()
  const comparisons: Array<{
    url: string
    single_total: number
    per_criterion_total: number
    per_criterion_max_diff: number
    weighted_diff: number
  }> = []

  for (const url of evalSet) {
    console.log(`\n=== ${url.url} ===`)
    
    const html = await fetchHtml(url.url)
    const content = normalizeHtml(html)
    
    const decision = makeRouteDecision({}, { tier: 'deep' })  // both run on Sonnet
    decision.provider = 'anthropic'
    decision.model_id = 'claude-sonnet-4.5'
    
    console.log(`  → Single-Call strategy...`)
    const singleResult = await runSingleCallStrategy({
      scrapedContent: content,
      routeDecision: decision,
    })
    const single_total = singleResult.full_check.criteria_scores.reduce((s, c) => s + c.score, 0)
    
    console.log(`  → Per-Criterion strategy...`)
    const perResult = await runPerCriterionStrategy({
      scrapedContent: content,
      routeDecision: decision,
    })
    const per_criterion_total = perResult.full_check.criteria_scores.reduce((s, c) => s + c.score, 0)
    
    // Per-criterion comparison
    let max_diff = 0
    for (let i = 0; i < 12; i++) {
      const single_score = singleResult.full_check.criteria_scores[i].score
      const per_score = perResult.full_check.criteria_scores[i].score
      max_diff = Math.max(max_diff, Math.abs(single_score - per_score))
    }
    
    const weighted_diff = Math.abs(single_total - per_criterion_total)
    
    comparisons.push({
      url: url.url,
      single_total,
      per_criterion_total,
      per_criterion_max_diff: max_diff,
      weighted_diff,
    })
    
    console.log(`     Single: ${single_total}, Per: ${per_criterion_total}, Diff: ${weighted_diff}, Max-Per-Criterion-Diff: ${max_diff}`)
  }
  
  // Aggregate verdict
  const avg_weighted_diff = comparisons.reduce((s, c) => s + c.weighted_diff, 0) / comparisons.length
  const avg_max_per_diff = comparisons.reduce((s, c) => s + c.per_criterion_max_diff, 0) / comparisons.length
  
  console.log('\n=== Verdict ===')
  console.log(`Average weighted-total disagreement: ${avg_weighted_diff.toFixed(2)} pt`)
  console.log(`Average max-per-criterion disagreement: ${avg_max_per_diff.toFixed(2)} pt`)
  
  if (avg_weighted_diff <= 5 && avg_max_per_diff <= 1.5) {
    console.log('✅ Single-Call wins (prior holds). Cost + latency favor single-call.')
  } else {
    console.log('⚠️ STOP — Single-Call vs Per-Criterion disagreement exceeds thresholds.')
    console.log('   Spot-check evidence quotes for both strategies on diverging URLs before deciding.')
    console.log('   Do NOT auto-pick per-criterion — investigate which strategy hallucinates.')
  }
}

runBenchmark().catch(err => {
  console.error('Strategy benchmark failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Add npm script**

Update `package.json`:

```json
{
  "scripts": {
    "benchmark:strategies": "tsx scripts/benchmark-strategies.ts"
  }
}
```

- [ ] **Step 3: Update scripts/README.md**

Append:

```markdown
## benchmark-strategies

Run Bob's §8 #1 Strategy-Benchmark (single-call vs per-criterion on Sonnet 4.5).

Requires: eval-set-phase-2.md populated + ANTHROPIC_API_KEY.

\`\`\`bash
pnpm benchmark:strategies
\`\`\`

Cost per run: ~€2 (5 URLs × 13 calls each = 65 calls × Sonnet pricing).
\`\`\`

- [ ] **Step 4: Verify compile**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/benchmark-strategies.ts package.json scripts/README.md
git commit -m "feat(scripts): add Strategy-Benchmark (single-call vs per-criterion, Bob's §8 #1)"
```

---

## Task 15: Open PR + CI Verification

**Files:** none (process task)

- [ ] **Step 1: Push branch**

```bash
cd ~/Developer/projects/neckarshore-ai/snakeoil-check && git push -u origin bob/2026-05-21-phase-2-a-foundation
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base main --head bob/2026-05-21-phase-2-a-foundation \
  --title "feat(phase-2-a): foundation — Router-Layer + Multi-Model + DB + Workflow + Benchmarks" \
  --body "$(cat <<'EOF'
## Summary

Phase-2-A Foundation implementation per design-doc `docs/superpowers/specs/2026-05-20-tiered-architecture-design.md`.

## What's New

- **Router-Layer** (`src/lib/router/`): Plugin-Signal pattern with env-driven config, tier-selection, path-selection, token-budget. 5 files + 5 test files.
- **Multi-Model Gateway** (`src/lib/ai/gateway.ts`): refactored to accept provider + model_id params dynamically.
- **Strategies Integration**: `single-call.ts` + `per-criterion.ts` now consume `RouteDecision` from Router-Layer.
- **DB Schema**: Drizzle migrations for `checks` + `check_results` tables.
- **Vercel Workflow**: Durable scrape → score → persist pipeline.
- **Benchmarks**: Cross-Model (Haiku vs Sonnet vs Gemini Flash) + Strategy (single-call vs per-criterion per Bob's §8 #1).

## Test Coverage

- Router-Layer: ~30 unit + integration tests
- DB Schema: 2 existence tests
- Workflow: 3 integration tests with mocked LLM
- Strategies: existing 22 tests + integration adjustments

Expected total: ~80+ tests passing.

## Out-of-Scope (Phase-2-B + Phase-2-C)

This PR sets up backend foundation. Following plans:

- **Phase-2-B Revenue Path**: Stripe Payment-Intent + Email-Verification + Anti-Abuse + API endpoints
- **Phase-2-C Frontend + Acquisition**: Landing/Gallery + Free-Shot Form + Checkout-Page + Result-Page + Resend Audiences

## Manual Steps Before Merge

- User must populate `docs/eval-set-phase-2.md` with 5 Eval-URLs (2 Gold + 2 Snake-Oil + 1 Ambiguous) before benchmark-scripts can run.

🤖 Generated via writing-plans skill with Claude Sonnet 4.6
EOF
)"
```

- [ ] **Step 3: Wait for CI green**

```bash
gh pr checks --watch
```

Expected: validate + tests + e2e all green.

- [ ] **Step 4: Notify User for review-merge**

Output to chat:

```
PR opened: <URL>
CI: green
Ready for User-merge. After merge: proceed to Plan B (Revenue Path).
```

---

## Spec Coverage Verification

| Spec Section | Implemented in Task |
|--------------|---------------------|
| §1 Vision + Funnel | (Out of plan — no code) |
| §2 System Architecture Overview | Tasks 7, 11, 12 (Router + Workflow skeleton) |
| §3 Router-Layer Design | Tasks 2-7 (all Router files + tests) |
| §3.4 env-driven Defaults | Task 1 (.env.example) + Task 3 (config.ts) |
| §3.5 Token-Budget | Task 6 (budget.ts) |
| §4 Pricing-Tier Implementation | (Phase-2-B + Phase-2-C — API + Frontend) |
| §5 Data Model — checks + check_results | Task 10 |
| §5 Data Model — email_verifications, rate_limits, etc. | (Phase-2-B) |
| §6 Cost + Margin Analysis | (Validated via Tasks 13 + 14 benchmarks) |
| §7 Anti-Abuse + Email-Verification | (Phase-2-B) |
| §8 Marketing Architecture | (Phase-2-C) |
| §9 Stripe Integration | (Phase-2-B) |
| §10 Error Handling | Task 12 (workflow try-catch + retry config) |
| §11 Testing Strategy | All tasks (TDD throughout) |
| §12 Dev/Prod Config | Task 1 (.env.example matrix) |
| §15 Open Question #11 (gateway.ts refactor) | Task 8 |

---

## End of Plan

Total: 15 Tasks. Estimated wall-clock: 6-10 hours of Bob-implementation-time (TDD discipline + commit cadence).

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-phase-2-a-foundation.md`.**

---

## Implementation Divergences (post-execution annotation — 2026-06-06)

> **Note:** This plan was written before implementation. During execution (Bob, 2026-05-20-c, PR #16 merged), the actual implementation diverged from the spec in six specific places. Each divergence was a deliberate, correct adaptation to the real SDK/API surface — **actual implementation diverged — kept** — captured here so future Bob-Dispatch sessions reading this plan know the spec is not 1:1 with the shipped code. Rationale lives in the cited commit messages.

| # | Spec said | Shipped instead | Where | Commit |
|---|-----------|-----------------|-------|--------|
| 1 | Vercel Workflow `workflow({name}, fn)` pattern | `'use workflow'` / `'use step'` directives + build-time `withWorkflow()` transform in `next.config.ts` (the actual published WDK API) | `next.config.ts`, `src/lib/workflow/` | `2471683` |
| 2 | `scrapeStep` accepts `string` | `scrapeStep` accepts `NormalizedDoc`; `fetchHtml()` returns a `FetchResult` object — enables richer prompt-building downstream | `src/lib/workflow/steps/scrape.ts` | `ccd6b4e` |
| 3 | DB schema split per-table under `src/db/schema/`; migrations in `src/db/migrations/` | Schema stays flat in `src/db/schema.ts`; migrations live in `./drizzle/` — preserves the existing Drizzle config | `src/db/schema.ts`, `drizzle/` | `38c95c4` |
| 4 | Budget-tier derived from the routing decision | Budget-tier mapped from `input.tier` in `scoreStep` — an escalated-standard customer still runs on the 30K budget (intentional cost-control; SC5, resolved 2026-05-20-d at 30K-keep) | `src/lib/workflow/steps/score.ts` | `2471683` |
| 5 | Free-shot tier flows through `decideTier()` | Free-shot bypasses `decideTier()` entirely and uses `ROUTER_FREESHOT_*` env config directly — free customers always get the free-shot model regardless of signals | `src/lib/router/index.ts:22-27` | `ef3dfa9` |
| 6 | (implicit) directives work as-is | `withWorkflow()` in `next.config.ts` is **mandatory** for the directive transforms — without it `'use workflow'` is a no-op string literal in production (fine for Vitest, breaks durability) | `next.config.ts` | `2471683` |

**Closes open_item `T-CARRY-PLAN-A-ANNOTATION-PASS`.**
