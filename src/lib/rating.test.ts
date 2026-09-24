import { describe, expect, it } from 'vitest';
import {
  POINTS,
  RATING_MAX,
  efficiency,
  expectedScore,
  formatDelta,
  formatLabel,
  kFactor,
  reliabilityFor,
  runRatingEngine,
  type RatingMatchInput,
} from './rating';

function match(overrides: Partial<RatingMatchInput>): RatingMatchInput {
  return {
    matchId: 'm1',
    weekId: 'w1',
    weekDate: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01T10:00:00Z'),
    teamAId: 'A',
    teamBId: 'B',
    teamAPlayerIds: ['a1', 'a2'],
    teamBPlayerIds: ['b1', 'b2'],
    sets: [
      [25, 20],
      [25, 18],
    ],
    ...overrides,
  };
}

const players = ['a1', 'a2', 'b1', 'b2'].map((id) => ({ id, baseLevel: 5 }));

describe('expectedScore', () => {
  it('is 0.5 for equal teams and symmetric', () => {
    expect(expectedScore(5, 5)).toBeCloseTo(0.5);
    expect(expectedScore(6, 4) + expectedScore(4, 6)).toBeCloseTo(1);
    expect(expectedScore(8, 5)).toBeCloseTo(10 / 11);
  });
});

describe('kFactor / reliability', () => {
  it('shrinks as a player gets more matches and in bigger teams', () => {
    expect(kFactor(0, 4)).toBeGreaterThan(kFactor(30, 4));
    expect(kFactor(0, 2)).toBeGreaterThan(kFactor(0, 6));
    expect(reliabilityFor(0)).toBe(0);
    expect(reliabilityFor(15)).toBeCloseTo(0.5);
    expect(reliabilityFor(100)).toBe(1);
  });
});

describe('runRatingEngine', () => {
  it('returns base levels when there are no matches', () => {
    const r = runRatingEngine([{ id: 'x', baseLevel: 7 }], []);
    expect(r.players.get('x')?.rating).toBe(7);
    expect(r.players.get('x')?.matches).toBe(0);
  });

  it('winners go up, losers go down, equal amounts for equal players (zero-sum)', () => {
    const r = runRatingEngine(players, [match({})]);
    const a1 = r.players.get('a1')!;
    const b1 = r.players.get('b1')!;
    expect(a1.rating).toBeGreaterThan(5);
    expect(b1.rating).toBeLessThan(5);
    expect(a1.rating - 5).toBeCloseTo(5 - b1.rating);
    expect(a1.history[0].format).toBe('2x2');
    expect(a1.history[0].won).toBe(true);
    expect(b1.history[0].won).toBe(false);
  });

  it('an upset win moves ratings more than an expected win', () => {
    const favWins = runRatingEngine(
      [{ id: 'a1', baseLevel: 8 }, { id: 'b1', baseLevel: 4 }],
      [match({ teamAPlayerIds: ['a1'], teamBPlayerIds: ['b1'] })]
    );
    const upset = runRatingEngine(
      [{ id: 'a1', baseLevel: 4 }, { id: 'b1', baseLevel: 8 }],
      [match({ teamAPlayerIds: ['a1'], teamBPlayerIds: ['b1'] })]
    );
    const favDelta = favWins.players.get('a1')!.history[0].delta;
    const upsetDelta = upset.players.get('a1')!.history[0].delta;
    expect(upsetDelta).toBeGreaterThan(favDelta);
    expect(upset.players.get('a1')!.points).toBe(POINTS.played + POINTS.win + POINTS.sweepBonus + POINTS.upsetBonus);
  });

  it('a 2-0 win moves more than a 2-1 win', () => {
    const sweep = runRatingEngine(players, [match({})]).players.get('a1')!.history[0].delta;
    const close = runRatingEngine(players, [match({ sets: [[25, 23], [23, 25], [15, 13]] })]).players.get('a1')!
      .history[0].delta;
    expect(sweep).toBeGreaterThan(close);
  });

  it('replays matches chronologically regardless of input order', () => {
    const m1 = match({ matchId: 'm1', weekDate: new Date('2026-01-01') });
    const m2 = match({ matchId: 'm2', weekDate: new Date('2026-01-08'), sets: [[20, 25], [18, 25]] });
    const r1 = runRatingEngine(players, [m1, m2]);
    const r2 = runRatingEngine(players, [m2, m1]);
    expect(r1.players.get('a1')!.rating).toBeCloseTo(r2.players.get('a1')!.rating);
    expect(r1.players.get('a1')!.history.map((h) => h.matchId)).toEqual(['m1', 'm2']);
  });

  it('supports uneven formats and labels them', () => {
    const r = runRatingEngine(players, [
      match({ teamAPlayerIds: ['a1', 'a2', 'x1'], teamBPlayerIds: ['b1', 'b2'] }),
    ]);
    expect(r.matches.get('m1')!.format).toBe('3x2');
    expect(r.players.get('x1')!.matches).toBe(1);
  });

  it('skips a player listed on both teams and skips invalid matches', () => {
    const r = runRatingEngine(players, [
      match({ teamAPlayerIds: ['a1', 'b1'], teamBPlayerIds: ['b1', 'b2'] }),
      match({ matchId: 'bad', sets: [[25, 20]] }),
    ]);
    expect(r.players.get('b1')!.matches).toBe(0);
    expect(r.players.get('a1')!.matches).toBe(1);
    expect(r.matches.has('bad')).toBe(false);
  });

  it('never exceeds the maximum', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      match({ matchId: `m${i}`, weekDate: new Date(2026, 0, i + 1), teamAPlayerIds: ['a1'], teamBPlayerIds: ['b1'] })
    );
    const r = runRatingEngine([{ id: 'a1', baseLevel: 9.9 }, { id: 'b1', baseLevel: 9.9 }], many);
    expect(r.players.get('a1')!.rating).toBeLessThanOrEqual(RATING_MAX);
  });

  it('adds MVP points', () => {
    const r = runRatingEngine(players, [], [{ weekId: 'w1', weekDate: new Date(), playerId: 'a1' }]);
    expect(r.players.get('a1')!.points).toBe(POINTS.mvp);
    expect(r.players.get('a1')!.mvpCount).toBe(1);
  });
});

describe('helpers', () => {
  it('formats labels and deltas', () => {
    expect(formatLabel(6, 6)).toBe('6x6');
    expect(formatLabel(4, 5)).toBe('4x5');
    expect(formatDelta(0.334)).toBe('+0,33');
    expect(formatDelta(-0.2)).toBe('−0,20');
  });

  it('computes efficiency over the last N matches', () => {
    const r = runRatingEngine(players, [
      match({ matchId: 'm1', weekDate: new Date('2026-01-01') }),
      match({ matchId: 'm2', weekDate: new Date('2026-01-02'), sets: [[20, 25], [18, 25]] }),
    ]);
    expect(efficiency(r.players.get('a1')!.history, 6)).toBe(50);
    expect(efficiency([], 6)).toBe(0);
  });
});

describe('solveBaseLevel', () => {
  it('finds the base level that yields the requested current level', async () => {
    const { solveBaseLevel } = await import('./rating');
    const ms = Array.from({ length: 6 }, (_, i) =>
      match({ matchId: `m${i}`, weekDate: new Date(2026, 0, i + 1), sets: i % 2 ? [[20, 25], [18, 25]] : [[25, 20], [25, 18]] })
    );
    const r = solveBaseLevel(players, ms, 'a1', 6.2);
    expect(r.resultingRating).toBeCloseTo(6.2, 2);
    const check = runRatingEngine(players.map((p) => (p.id === 'a1' ? { ...p, baseLevel: r.baseLevel } : p)), ms);
    expect(check.players.get('a1')!.rating).toBeCloseTo(6.2, 2);
  });

  it('without matches base equals the target', async () => {
    const { solveBaseLevel } = await import('./rating');
    expect(solveBaseLevel([{ id: 'x', baseLevel: 5 }], [], 'x', 7.35).baseLevel).toBeCloseTo(7.35, 2);
  });
});
