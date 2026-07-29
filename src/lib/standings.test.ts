// src/lib/standings.test.ts
import { describe, it, expect } from 'vitest';
import { computeStandings } from './standings';

describe('computeStandings', () => {
  const teams = [
    { id: 't1', name: 'Takım A' },
    { id: 't2', name: 'Takım B' },
    { id: 't3', name: 'Takım C' },
  ];

  it('ranks teams by points, then by set difference', () => {
    const matches = [
      { teamAId: 't1', teamBId: 't2', sets: [[25, 20], [25, 18]] as [number, number][] },
      { teamAId: 't1', teamBId: 't3', sets: [[25, 20], [20, 25], [15, 10]] as [number, number][] },
      { teamAId: 't2', teamBId: 't3', sets: [[20, 25], [22, 25]] as [number, number][] },
    ];
    const standings = computeStandings({ teams, matches });

    expect(standings.map((r) => r.teamId)).toEqual(['t1', 't3', 't2']);
    expect(standings[0]).toMatchObject({ teamId: 't1', played: 2, won: 2, lost: 0, points: 5 });
    expect(standings[1]).toMatchObject({ teamId: 't3', played: 2, won: 1, lost: 1, points: 3 });
    expect(standings[2]).toMatchObject({ teamId: 't2', played: 2, won: 0, lost: 2, points: 0 });
  });

  it('returns a zeroed row for a team with no matches yet', () => {
    const standings = computeStandings({ teams, matches: [] });
    expect(standings).toHaveLength(3);
    expect(standings.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});
