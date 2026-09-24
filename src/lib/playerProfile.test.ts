import { describe, expect, it } from 'vitest';
import { buildPlayerRatingProfile } from './playerProfile';
import { runRatingEngine } from './rating';
import type { RatedMatchInfo, RatingSnapshot } from './ratingService';
import type { SetScore } from './matchScoring';

function snapshot(): RatingSnapshot {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => ({
    id,
    name: `Oyuncu ${i + 1}`,
    avatarUrl: null,
    position: null,
    isActive: true,
    baseLevel: 5,
  }));
  const mk = (id: string, day: number, a: string[], b: string[], sets: SetScore[]): RatedMatchInfo => ({
    id,
    weekId: `w${day}`,
    weekDate: new Date(2026, 0, day),
    createdAt: new Date(2026, 0, day),
    targetPoints: 25,
    sets,
    teamA: { id: `${id}-A`, name: 'Takım A', playerIds: a },
    teamB: { id: `${id}-B`, name: 'Takım B', playerIds: b },
  });
  const matches = [
    mk('m1', 1, ['p1', 'p2'], ['p3', 'p4'], [[25, 20], [25, 18]]),
    mk('m2', 2, ['p1', 'p2', 'p5'], ['p3', 'p4', 'p6'], [[20, 25], [25, 20], [10, 15]]),
    mk('m3', 3, ['p1', 'p3'], ['p2', 'p4'], [[25, 22], [25, 23]]),
  ];
  const engine = runRatingEngine(
    players.map((p) => ({ id: p.id, baseLevel: p.baseLevel })),
    matches.map((m) => ({
      matchId: m.id,
      weekId: m.weekId,
      weekDate: m.weekDate,
      createdAt: m.createdAt,
      teamAId: m.teamA.id,
      teamBId: m.teamB.id,
      teamAPlayerIds: m.teamA.playerIds,
      teamBPlayerIds: m.teamB.playerIds,
      sets: m.sets,
    }))
  );
  const ranking = Array.from(engine.players.values())
    .filter((s) => s.matches > 0)
    .sort((a, b) => b.rating - a.rating)
    .map((s) => s.playerId);
  return {
    ...engine,
    playersById: new Map(players.map((p) => [p.id, p])),
    matchesById: new Map(matches.map((m) => [m.id, m])),
    mvpsByPlayer: new Map(),
    ranking,
  };
}

describe('buildPlayerRatingProfile', () => {
  it('builds cards newest first with the player on "mine" side', () => {
    const profile = buildPlayerRatingProfile(snapshot(), 'p1')!;
    expect(profile.matches).toBe(3);
    expect(profile.wins).toBe(2);
    expect(profile.cards.map((c) => c.matchId)).toEqual(['m3', 'm2', 'm1']);
    expect(profile.cards[0].mine.players[0].id).toBe('p1');
    expect(profile.cards[1].format).toBe('3x3');
    expect(profile.cards[1].mine.sets).toEqual([20, 25, 10]);
    expect(profile.cards[1].opponent.won).toBe(true);
  });

  it('counts partners and opponents', () => {
    const profile = buildPlayerRatingProfile(snapshot(), 'p1')!;
    const p2 = profile.partners.find((p) => p.playerId === 'p2')!;
    expect(p2.matches).toBe(2);
    expect(p2.wins).toBe(1);
    expect(profile.partners[0].playerId).toBe('p2');
    const p4 = profile.opponents.find((p) => p.playerId === 'p4')!;
    expect(p4.matches).toBe(3);
    expect(profile.formats).toEqual([
      { format: '2x2', matches: 2, wins: 2 },
      { format: '3x3', matches: 1, wins: 0 },
    ]);
  });

  it('level history ends at current rating and rank is set', () => {
    const snap = snapshot();
    const profile = buildPlayerRatingProfile(snap, 'p1')!;
    expect(profile.levelHistory.at(-1)!.level).toBeCloseTo(profile.rating);
    expect(profile.rank).toBe(snap.ranking.indexOf('p1') + 1);
    expect(profile.efficiencyLast6).toBeCloseTo((2 / 3) * 100);
  });

  it('returns a zero-match profile for a player without matches', () => {
    const profile = buildPlayerRatingProfile(snapshot(), 'p6');
    expect(profile!.matches).toBe(1);
    expect(buildPlayerRatingProfile(snapshot(), 'unknown')).toBeNull();
  });
});
