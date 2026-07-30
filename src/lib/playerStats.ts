import { computeMatchResult, type SetScore } from './matchScoring';

export interface PlayerMatchAssignment {
  matchId: string;
  weekId: string;
  weekDate: Date;
  matchCreatedAt: Date;
  teamId: string;
  teamAId: string;
  teamBId: string;
  sets: SetScore[];
}

export interface PlayerMatchRecord {
  matchId: string;
  weekId: string;
  weekDate: Date;
  matchCreatedAt: Date;
  teamId: string;
  opponentTeamId: string;
  won: boolean;
  setsWonByPlayer: number;
  setsLostByPlayer: number;
}

export interface PlayerStatsResult {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  weeksPlayed: number;
  currentWinStreak: number;
  longestWinStreak: number;
  last10: Array<'W' | 'L'>;
  records: PlayerMatchRecord[];
  integrityWarnings: string[];
}

export function countDistinctWeeks(weekIds: string[]): number {
  return new Set(weekIds).size;
}

export function computePlayerStats(assignments: PlayerMatchAssignment[]): PlayerStatsResult {
  const byMatch = new Map<string, PlayerMatchAssignment[]>();
  for (const assignment of assignments) {
    const list = byMatch.get(assignment.matchId) ?? [];
    list.push(assignment);
    byMatch.set(assignment.matchId, list);
  }

  const integrityWarnings: string[] = [];
  const records: PlayerMatchRecord[] = [];

  for (const [matchId, group] of byMatch) {
    if (group.length > 1) {
      integrityWarnings.push(
        `${matchId}: oyuncu maçın her iki takımında da kayıtlı, istatistiklere dahil edilmedi`
      );
      continue;
    }

    const assignment = group[0];
    const result = computeMatchResult(assignment.sets);
    const playerIsTeamA = assignment.teamId === assignment.teamAId;
    const won = playerIsTeamA ? result.winner === 'A' : result.winner === 'B';
    const setsWonByPlayer = playerIsTeamA ? result.setsWonA : result.setsWonB;
    const setsLostByPlayer = playerIsTeamA ? result.setsWonB : result.setsWonA;
    const opponentTeamId = playerIsTeamA ? assignment.teamBId : assignment.teamAId;

    records.push({
      matchId,
      weekId: assignment.weekId,
      weekDate: assignment.weekDate,
      matchCreatedAt: assignment.matchCreatedAt,
      teamId: assignment.teamId,
      opponentTeamId,
      won,
      setsWonByPlayer,
      setsLostByPlayer,
    });
  }

  records.sort((a, b) => {
    const dateDiff = a.weekDate.getTime() - b.weekDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    const createdDiff = a.matchCreatedAt.getTime() - b.matchCreatedAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.matchId.localeCompare(b.matchId);
  });

  const matchesPlayed = records.length;
  const wins = records.filter((r) => r.won).length;
  const losses = matchesPlayed - wins;
  const winRate = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
  const setsWon = records.reduce((sum, r) => sum + r.setsWonByPlayer, 0);
  const setsLost = records.reduce((sum, r) => sum + r.setsLostByPlayer, 0);
  const weeksPlayed = countDistinctWeeks(records.map((r) => r.weekId));

  let longestWinStreak = 0;
  let running = 0;
  for (const r of records) {
    running = r.won ? running + 1 : 0;
    if (running > longestWinStreak) longestWinStreak = running;
  }

  let currentWinStreak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].won) currentWinStreak++;
    else break;
  }

  const last10: Array<'W' | 'L'> = records.slice(-10).map((r) => (r.won ? 'W' : 'L'));

  return {
    matchesPlayed,
    wins,
    losses,
    winRate,
    setsWon,
    setsLost,
    setDiff: setsWon - setsLost,
    weeksPlayed,
    currentWinStreak,
    longestWinStreak,
    last10,
    records,
    integrityWarnings,
  };
}
