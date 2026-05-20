import { describe, expect, it } from 'vitest';
import { decideTier } from '../signals';
import type { RouteSignals } from '../types';

describe('decideTier', () => {
  it('returns 1 by default (no signals)', () => {
    expect(decideTier({})).toBe(1);
  });

  it('returns 2 when customer_explicit_deep_analysis is true', () => {
    expect(decideTier({ customer_explicit_deep_analysis: true })).toBe(2);
  });

  it('returns 1 when customer_explicit_deep_analysis is false', () => {
    expect(decideTier({ customer_explicit_deep_analysis: false })).toBe(1);
  });

  it('returns 2 when stake_indicator is high', () => {
    expect(decideTier({ stake_indicator: 'high' })).toBe(2);
  });

  it('returns 1 when stake_indicator is medium', () => {
    expect(decideTier({ stake_indicator: 'medium' })).toBe(1);
  });

  it('returns 1 when stake_indicator is low', () => {
    expect(decideTier({ stake_indicator: 'low' })).toBe(1);
  });

  it('returns 2 when both signals trigger (toggle + high-stake)', () => {
    expect(
      decideTier({
        customer_explicit_deep_analysis: true,
        stake_indicator: 'high',
      }),
    ).toBe(2);
  });

  it('returns 2 if toggle is true even with low stake', () => {
    expect(
      decideTier({
        customer_explicit_deep_analysis: true,
        stake_indicator: 'low',
      }),
    ).toBe(2);
  });

  it('ignores Phase-3 stub signals (domain_classifier_label)', () => {
    const signals: RouteSignals = { domain_classifier_label: 'medical-claims' };
    expect(decideTier(signals)).toBe(1);
  });

  it('ignores Phase-3 stub signals (tier1_confidence)', () => {
    const signals: RouteSignals = { tier1_confidence: 0.3 };
    expect(decideTier(signals)).toBe(1);
  });
});
