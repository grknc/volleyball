import { describe, it, expect } from 'vitest';
import { computeMatchResult, isCompletedMatch, type SetScore } from './matchScoring';

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

describe('isCompletedMatch', () => {
  it('returns true for a valid 2-set sweep', () => {
    expect(isCompletedMatch({ sets: [[25, 20], [25, 18]] })).toBe(true);
  });

  it('returns true for a valid 3-set match', () => {
    expect(isCompletedMatch({ sets: [[25, 20], [20, 25], [15, 10]] })).toBe(true);
  });

  it('returns false when fewer than 2 sets are recorded', () => {
    expect(isCompletedMatch({ sets: [] })).toBe(false);
    expect(isCompletedMatch({ sets: [[25, 20]] })).toBe(false);
  });

  it('returns false when the recorded sets are invalid (e.g. a tied set)', () => {
    expect(isCompletedMatch({ sets: [[20, 20], [25, 20]] })).toBe(false);
  });

  it('trusts an explicit status field over the sets array when present', () => {
    expect(isCompletedMatch({ sets: [], status: 'COMPLETED' })).toBe(true);
    expect(isCompletedMatch({ sets: [[25, 20], [25, 18]], status: 'CANCELLED' })).toBe(false);
    expect(isCompletedMatch({ sets: [[25, 20], [25, 18]], status: 'SCHEDULED' })).toBe(false);
  });
});

describe('isCompletedMatch regression — preserves weekView.ts\'s previous inline `sets.length >= 2` check', () => {
  const validSweep: SetScore[] = [[25, 20], [25, 18]];
  const validThreeSet: SetScore[] = [[25, 20], [20, 25], [15, 10]];
  const noSets: SetScore[] = [];
  const oneSet: SetScore[] = [[25, 20]];

  it('agrees with the old check for every case weekView.ts actually encounters today', () => {
    // Before this task, weekView.ts computed: sets.length >= 2 ? computeMatchResult(sets) : null
    // and filtered playedMatches with sets.length >= 2. isCompletedMatch must return the same
    // true/false for all of these so getWeekView()'s output is byte-for-byte unchanged.
    expect(isCompletedMatch({ sets: validSweep })).toBe(true);
    expect(isCompletedMatch({ sets: validThreeSet })).toBe(true);
    expect(isCompletedMatch({ sets: noSets })).toBe(false);
    expect(isCompletedMatch({ sets: oneSet })).toBe(false);
  });

  it('differs from the old inline check only for corrupted set data that can never reach the database in practice', () => {
    // The old weekView.ts code was: sets.length >= 2 ? computeMatchResult(sets) : null — with NO
    // try/catch. If a match somehow had length >= 2 but invalid content (e.g. a tied set),
    // computeMatchResult would throw *uncaught*, crashing the whole getWeekView() call.
    // isCompletedMatch catches that internally and returns false instead, so this specific
    // edge case now degrades gracefully rather than crashing. This is a safe improvement, not a
    // silent behavior change that matters in practice: the existing PATCH /api/admin/matches/[id]
    // endpoint already runs match sets through computeMatchResult before persisting, so invalid
    // set data (like a tie) is rejected at write time and should never exist in the database.
    const corruptTie: SetScore[] = [[20, 20], [25, 18]];
    expect(() => isCompletedMatch({ sets: corruptTie })).not.toThrow();
    expect(isCompletedMatch({ sets: corruptTie })).toBe(false);
  });
});
