import { describe, expect, it } from 'vitest';
import {
  CRITERIA,
  computeWeightedTotal,
  MAX_WEIGHTED_TOTAL,
  RUBRIC_VERSION,
  tendencyFor,
} from '../criteria';

describe('scoring criteria table', () => {
  it('has 12 criteria with unique IDs 1..12', () => {
    expect(CRITERIA).toHaveLength(12);
    const ids = CRITERIA.map((c) => c.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has exactly 5 criteria flagged for Free-Shot (IDs 1, 4, 7, 10, 11)', () => {
    const freeShotIds = CRITERIA.filter((c) => c.inFreeShot)
      .map((c) => c.id)
      .sort((a, b) => a - b);
    expect(freeShotIds).toEqual([1, 4, 7, 10, 11]);
  });

  it('total weight = 80 per §2', () => {
    const totalWeight = CRITERIA.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBe(80);
  });

  it('MAX_WEIGHTED_TOTAL = 800 (80 * 10)', () => {
    expect(MAX_WEIGHTED_TOTAL).toBe(800);
  });

  it('RUBRIC_VERSION is semver-shaped', () => {
    expect(RUBRIC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('tendencyFor', () => {
  it('buckets per §1: >=75 Go, 45-74 Vorsicht, <45 Lieber lassen', () => {
    expect(tendencyFor(100)).toBe('Go');
    expect(tendencyFor(75)).toBe('Go');
    expect(tendencyFor(74)).toBe('Vorsicht');
    expect(tendencyFor(45)).toBe('Vorsicht');
    expect(tendencyFor(44)).toBe('Lieber lassen');
    expect(tendencyFor(0)).toBe('Lieber lassen');
  });
});

describe('computeWeightedTotal', () => {
  it('returns 100 when every criterion scores 10', () => {
    const allTens = CRITERIA.map((c) => ({ criterionId: c.id, rawScore: 10 }));
    expect(computeWeightedTotal(allTens)).toBe(100);
  });

  it('returns 0 when every criterion scores 0', () => {
    const allZeros = CRITERIA.map((c) => ({ criterionId: c.id, rawScore: 0 }));
    expect(computeWeightedTotal(allZeros)).toBe(0);
  });

  it('throws on unknown criterion id', () => {
    expect(() => computeWeightedTotal([{ criterionId: 999, rawScore: 5 }])).toThrow();
  });
});
