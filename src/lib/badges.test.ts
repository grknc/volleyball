import { describe, expect, it } from 'vitest';
import { computeBadges } from './badges';
import { runRatingEngine, type RatingMatchInput } from './rating';
import type { SetScore } from './matchScoring';

const WIN: SetScore[] = [
  [25, 15],
  [25, 18],
];
const LOSS: SetScore[] = [
  [15, 25],
  [18, 25],
];
const COMEBACK: SetScore[] = [
  [20, 25],
  [25, 20],
  [15, 10],
];

function m(i: number, sets: SetScore[], a = ['me', 'x'], b = ['y', 'z']): RatingMatchInput {
  return {
    matchId: `m${i}`,
    weekId: `w${i}`,
    weekDate: new Date(2026, 0, i + 1),
    createdAt: new Date(2026, 0, i + 1),
    teamAId: `A${i}`,
    teamBId: `B${i}`,
    teamAPlayerIds: a,
    teamBPlayerIds: b,
    sets,
  };
}

const players = ['me', 'x', 'y', 'z', 'q', 'r'].map((id) => ({ id, baseLevel: 5 }));

function badgesOf(matches: RatingMatchInput[], mvps: Array<{ weekId: string; weekDate: Date }> = []) {
  const state = runRatingEngine(players, matches).players.get('me')!;
  return new Map(computeBadges(state, mvps).map((b) => [b.def.id, b]));
}

describe('computeBadges', () => {
  it('nothing earned without matches', () => {
    const b = badgesOf([]);
    expect([...b.values()].some((x) => x.earned)).toBe(false);
  });

  it('first match / first win are earned in the right week', () => {
    const b = badgesOf([m(0, LOSS), m(1, WIN)]);
    expect(b.get('ilk-mac')!.earnedAt!.weekId).toBe('w0');
    expect(b.get('ilk-galibiyet')!.earnedAt!.weekId).toBe('w1');
    expect(b.get('mac-10')!.earned).toBe(false);
    expect(b.get('mac-10')!.current).toBe(2);
  });

  it('win streak of 3 (not broken streak)', () => {
    const b1 = badgesOf([m(0, WIN), m(1, WIN), m(2, LOSS), m(3, WIN)]);
    expect(b1.get('seri-3')!.earned).toBe(false);
    const b2 = badgesOf([m(0, WIN), m(1, WIN), m(2, WIN)]);
    expect(b2.get('seri-3')!.earnedAt!.weekId).toBe('w2');
  });

  it('comeback, formats and 2x2 wins', () => {
    const b = badgesOf([
      m(0, COMEBACK),
      m(1, WIN, ['me', 'x', 'q'], ['y', 'z', 'r']),
      m(2, WIN, ['me', 'x', 'q', 'r'], ['y', 'z', 'a1', 'a2']),
      m(3, WIN),
    ]);
    expect(b.get('geri-donus')!.earnedAt!.weekId).toBe('w0');
    expect(b.get('cok-yonlu')!.earnedAt!.weekId).toBe('w2');
    expect(b.get('ikili-usta')!.current).toBe(2);
  });

  it('upset badge when beating a much stronger team', () => {
    const state = runRatingEngine(
      [
        { id: 'me', baseLevel: 3 },
        { id: 'y', baseLevel: 8 },
      ],
      [m(0, WIN, ['me'], ['y'])]
    ).players.get('me')!;
    const b = new Map(computeBadges(state).map((x) => [x.def.id, x]));
    expect(b.get('dev-avcisi')!.earned).toBe(true);
  });

  it('MVP badges use MVP dates', () => {
    const b = badgesOf([m(0, WIN)], [{ weekId: 'w0', weekDate: new Date(2026, 0, 1) }]);
    expect(b.get('mvp-1')!.earnedAt!.weekId).toBe('w0');
    expect(b.get('mvp-3')!.current).toBe(1);
  });
});
