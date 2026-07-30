import { describe, expect, it } from 'vitest';
import { computePlayerStats, countDistinctWeeks, type PlayerMatchAssignment } from './playerStats';

function assignment(overrides: Partial<PlayerMatchAssignment>): PlayerMatchAssignment {
  return {
    matchId: 'match-1',
    weekId: 'week-1',
    weekDate: new Date('2026-01-01'),
    matchCreatedAt: new Date('2026-01-01T10:00:00Z'),
    teamId: 'team-a',
    teamAId: 'team-a',
    teamBId: 'team-b',
    sets: [
      [25, 20],
      [25, 18],
    ],
    ...overrides,
  };
}

describe('countDistinctWeeks', () => {
  it('counts unique week ids', () => {
    expect(countDistinctWeeks(['w1', 'w1', 'w2'])).toBe(2);
    expect(countDistinctWeeks([])).toBe(0);
  });
});

describe('computePlayerStats', () => {
  it('handles a player with no matches (no division by zero)', () => {
    const stats = computePlayerStats([]);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.weeksPlayed).toBe(0);
    expect(stats.last10).toEqual([]);
    expect(stats.integrityWarnings).toEqual([]);
  });

  it('counts a single win correctly', () => {
    const stats = computePlayerStats([assignment({})]);
    expect(stats.matchesPlayed).toBe(1);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
    expect(stats.winRate).toBe(100);
    expect(stats.setsWon).toBe(2);
    expect(stats.setsLost).toBe(0);
    expect(stats.weeksPlayed).toBe(1);
  });

  it('counts a loss correctly when the player is on teamB', () => {
    const stats = computePlayerStats([
      assignment({ teamId: 'team-b', sets: [[25, 20], [25, 18]] }),
    ]);
    expect(stats.wins).toBe(0);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(0);
  });

  it('counts matches across multiple distinct weeks', () => {
    const stats = computePlayerStats([
      assignment({ matchId: 'm1', weekId: 'week-1' }),
      assignment({ matchId: 'm2', weekId: 'week-2' }),
    ]);
    expect(stats.matchesPlayed).toBe(2);
    expect(stats.weeksPlayed).toBe(2);
  });

  it('counts two matches in the same week on different teams as two separate matches (not a conflict)', () => {
    const stats = computePlayerStats([
      assignment({ matchId: 'm1', weekId: 'week-1', teamId: 'team-a', teamAId: 'team-a', teamBId: 'team-b' }),
      assignment({ matchId: 'm2', weekId: 'week-1', teamId: 'team-c', teamAId: 'team-c', teamBId: 'team-d' }),
    ]);
    expect(stats.matchesPlayed).toBe(2);
    expect(stats.weeksPlayed).toBe(1);
    expect(stats.integrityWarnings).toEqual([]);
  });

  it('excludes a match and records a warning when the player is assigned to both teams of the same match', () => {
    const stats = computePlayerStats([
      assignment({ matchId: 'm1', teamId: 'team-a' }),
      assignment({ matchId: 'm1', teamId: 'team-b' }),
    ]);
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.integrityWarnings).toHaveLength(1);
    expect(stats.integrityWarnings[0]).toContain('m1');
  });

  it('computes current vs. longest win streak separately', () => {
    // Chronological order: W, W, L, W  => longest streak is 2 (the first two wins), current streak is 1 (the last match)
    const stats = computePlayerStats([
      assignment({ matchId: 'm1', weekDate: new Date('2026-01-01'), sets: [[25, 20], [25, 18]] }),
      assignment({ matchId: 'm2', weekDate: new Date('2026-01-08'), sets: [[25, 20], [25, 18]] }),
      assignment({ matchId: 'm3', weekDate: new Date('2026-01-15'), sets: [[20, 25], [18, 25]] }),
      assignment({ matchId: 'm4', weekDate: new Date('2026-01-22'), sets: [[25, 20], [25, 18]] }),
    ]);
    expect(stats.longestWinStreak).toBe(2);
    expect(stats.currentWinStreak).toBe(1);
  });

  it('returns only the last 10 matches in last10, in chronological order', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      assignment({
        matchId: `m${i}`,
        weekDate: new Date(2026, 0, i + 1),
        sets: i % 2 === 0 ? [[25, 20], [25, 18]] : [[20, 25], [18, 25]],
      })
    );
    const stats = computePlayerStats(assignments);
    expect(stats.last10).toHaveLength(10);
    // matches m2..m11 (the last 10 of 12), m2 is a win (even index)
    expect(stats.last10[0]).toBe('W');
  });
});
