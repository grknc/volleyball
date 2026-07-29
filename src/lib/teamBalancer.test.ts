import { describe, it, expect } from 'vitest';
import { balanceTeams } from './teamBalancer';

describe('balanceTeams', () => {
  it('splits 8 players into 2 level-balanced teams via snake draft', () => {
    const players = [
      { id: '1', name: 'A', level: 10 },
      { id: '2', name: 'B', level: 9 },
      { id: '3', name: 'C', level: 8 },
      { id: '4', name: 'D', level: 7 },
      { id: '5', name: 'E', level: 6 },
      { id: '6', name: 'F', level: 5 },
      { id: '7', name: 'G', level: 4 },
      { id: '8', name: 'H', level: 3 },
    ];
    const teams = balanceTeams(players, 2);
    expect(teams).toHaveLength(2);
    const levelSum = (team: (typeof teams)[number]) =>
      team.players.reduce((sum, p) => sum + p.level, 0);
    expect(levelSum(teams[0])).toBe(26);
    expect(levelSum(teams[1])).toBe(26);
    expect(teams[0].players.map((p) => p.id)).toEqual(['1', '4', '5', '8']);
    expect(teams[1].players.map((p) => p.id)).toEqual(['2', '3', '6', '7']);
  });

  it('throws when there are fewer players than requested teams', () => {
    const players = [{ id: '1', name: 'A', level: 5 }];
    expect(() => balanceTeams(players, 2)).toThrow();
  });

  it('throws when fewer than 2 teams are requested', () => {
    const players = [
      { id: '1', name: 'A', level: 5 },
      { id: '2', name: 'B', level: 4 },
    ];
    expect(() => balanceTeams(players, 1)).toThrow();
  });
});
