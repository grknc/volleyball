import { computeMatchResult, type SetScore } from './matchScoring';

export interface StandingsTeam {
  id: string;
  name: string;
}

export interface StandingsMatch {
  teamAId: string;
  teamBId: string;
  sets: SetScore[];
}

export interface StandingsInput {
  teams: StandingsTeam[];
  matches: StandingsMatch[];
}

export interface StandingsRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  setDiff: number;
}

export function computeStandings({ teams, matches }: StandingsInput): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const team of teams) {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsFor: 0,
      setsAgainst: 0,
      setDiff: 0,
    });
  }

  for (const match of matches) {
    const rowA = rows.get(match.teamAId);
    const rowB = rows.get(match.teamBId);
    if (!rowA || !rowB) {
      throw new Error('Maç, tabloda olmayan bir takıma referans veriyor');
    }
    const result = computeMatchResult(match.sets);

    rowA.played++;
    rowB.played++;
    rowA.setsFor += result.setsWonA;
    rowA.setsAgainst += result.setsWonB;
    rowB.setsFor += result.setsWonB;
    rowB.setsAgainst += result.setsWonA;
    rowA.points += result.pointsA;
    rowB.points += result.pointsB;

    if (result.winner === 'A') {
      rowA.won++;
      rowB.lost++;
    } else {
      rowB.won++;
      rowA.lost++;
    }
  }

  for (const row of rows.values()) {
    row.setDiff = row.setsFor - row.setsAgainst;
  }

  return Array.from(rows.values()).sort((a, b) => b.points - a.points || b.setDiff - a.setDiff);
}
