import { describe, it, expect } from 'vitest';
import { balanceTeams, roleOf, suggestFormats, summarizeTeam, type PlayerInput } from './teamBalancer';

const levelSum = (team: { players: PlayerInput[] }) => team.players.reduce((sum, p) => sum + p.level, 0);

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('balanceTeams', () => {
  it('splits 8 players without positions into 2 level-balanced teams', () => {
    const players = [10, 9, 8, 7, 6, 5, 4, 3].map((level, i) => ({ id: String(i + 1), name: `P${i}`, level }));
    const teams = balanceTeams(players, 2);
    expect(teams).toHaveLength(2);
    expect(teams.map((t) => t.players.length)).toEqual([4, 4]);
    expect(levelSum(teams[0])).toBe(26);
    expect(levelSum(teams[1])).toBe(26);
  });

  it('puts one setter in each team even when setters are the strongest players', () => {
    const players: PlayerInput[] = [
      { id: 's1', name: 'Pasör 1', level: 9, position: 'Pasör' },
      { id: 's2', name: 'Pasör 2', level: 8.5, position: 'Pasör' },
      { id: 'h1', name: 'H1', level: 7, position: 'Smaçör' },
      { id: 'h2', name: 'H2', level: 6, position: 'Smaçör' },
      { id: 'h3', name: 'H3', level: 5, position: 'Çaprazcı' },
      { id: 'h4', name: 'H4', level: 4, position: null },
    ];
    const teams = balanceTeams(players, 2);
    for (const t of teams) {
      expect(t.players.filter((p) => p.position === 'Pasör')).toHaveLength(1);
      expect(t.players[0].position).toBe('Pasör');
    }
    expect(Math.abs(levelSum(teams[0]) - levelSum(teams[1]))).toBeLessThanOrEqual(1);
  });

  it('spreads setters and middles across 3 teams', () => {
    const players: PlayerInput[] = [
      ...[8, 6, 5].map((l, i) => ({ id: `s${i}`, name: `S${i}`, level: l, position: 'Pasör' })),
      ...[7, 7, 4].map((l, i) => ({ id: `m${i}`, name: `M${i}`, level: l, position: 'Orta Oyuncu' })),
      ...[9, 6, 5, 5, 3, 2].map((l, i) => ({ id: `h${i}`, name: `H${i}`, level: l, position: 'Smaçör' })),
    ];
    const teams = balanceTeams(players, 3);
    for (const t of teams) {
      expect(t.players).toHaveLength(4);
      expect(t.players.filter((p) => roleOf(p.position) === 'Pasör')).toHaveLength(1);
      expect(t.players.filter((p) => roleOf(p.position) === 'Orta Oyuncu')).toHaveLength(1);
    }
    const sums = teams.map(levelSum);
    expect(Math.max(...sums) - Math.min(...sums)).toBeLessThanOrEqual(2);
  });

  it('keeps team sizes within 1 of each other', () => {
    const players = Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, name: `P${i}`, level: 10 - i }));
    const sizes = balanceTeams(players, 2).map((t) => t.players.length).sort();
    expect(sizes).toEqual([3, 4]);
  });

  it('uses every player exactly once, also with variation', () => {
    const players = Array.from({ length: 13 }, (_, i) => ({
      id: `${i}`,
      name: `P${i}`,
      level: (i % 5) + 3,
      position: i % 4 === 0 ? 'Pasör' : 'Smaçör',
    }));
    const teams = balanceTeams(players, 3, { variation: 1, random: seeded(42) });
    const ids = teams.flatMap((t) => t.players.map((p) => p.id)).sort();
    expect(ids).toEqual(players.map((p) => p.id).sort());
  });

  it('throws when there are fewer players than requested teams', () => {
    expect(() => balanceTeams([{ id: '1', name: 'A', level: 5 }], 2)).toThrow();
  });

  it('throws when fewer than 2 teams are requested', () => {
    const players = [
      { id: '1', name: 'A', level: 5 },
      { id: '2', name: 'B', level: 4 },
    ];
    expect(() => balanceTeams(players, 1)).toThrow();
  });
});

describe('summarizeTeam', () => {
  it('warns about missing setter and middle', () => {
    const s = summarizeTeam([
      { id: '1', name: 'A', level: 5, position: 'Smaçör' },
      { id: '2', name: 'B', level: 5, position: 'Smaçör' },
      { id: '3', name: 'C', level: 5, position: 'Libero' },
      { id: '4', name: 'D', level: 5, position: null },
    ]);
    expect(s.warnings).toEqual(['Pasör yok', 'Orta oyuncu yok']);
    expect(s.levelAvg).toBe(5);
    expect(s.roles['Hücum']).toBe(2);
  });
});

describe('suggestFormats', () => {
  it('prefers no bench and bigger teams', () => {
    expect(suggestFormats(12).map((f) => f.label)).toEqual([
      '2 takım × 6x6',
      '3 takım × 4x4',
      '4 takım × 3x3',
    ]);
    expect(suggestFormats(13)[0]).toMatchObject({ teamSize: 6, teamCount: 2, bench: 1 });
    expect(suggestFormats(3)).toEqual([]);
  });
});
