import { describe, it, expect } from 'vitest';
import { computeMatchResult } from './matchScoring';

describe('computeMatchResult', () => {
  it('awards 3 points for a 2-0 sweep', () => {
    const result = computeMatchResult([[25, 20], [25, 18]]);
    expect(result).toEqual({ setsWonA: 2, setsWonB: 0, winner: 'A', pointsA: 3, pointsB: 0 });
  });

  it('awards 2 points for a 2-1 win', () => {
    const result = computeMatchResult([[25, 20], [20, 25], [15, 10]]);
    expect(result).toEqual({ setsWonA: 2, setsWonB: 1, winner: 'A', pointsA: 2, pointsB: 0 });
  });

  it('lets team B win 2-1', () => {
    const result = computeMatchResult([[20, 25], [25, 22], [10, 15]]);
    expect(result).toEqual({ setsWonA: 1, setsWonB: 2, winner: 'B', pointsA: 0, pointsB: 2 });
  });

  it('throws when a set ends in a tie', () => {
    expect(() => computeMatchResult([[25, 25], [25, 20]])).toThrow();
  });

  it('throws when there are fewer than 2 sets', () => {
    expect(() => computeMatchResult([[25, 20]])).toThrow();
  });

  it('throws when there are more than 3 sets', () => {
    expect(() =>
      computeMatchResult([[25, 20], [20, 25], [25, 20], [25, 20]]),
    ).toThrow();
  });

  it('throws when a team sweeps all 3 sets in a best-of-3 (invalid input)', () => {
    expect(() => computeMatchResult([[25, 20], [25, 18], [25, 15]])).toThrow();
  });
});
