import { computeMatchResult, type SetScore } from './matchScoring';

export interface MatchRecordInput {
  matchId: string;
  weekId: string;
  weekDate: Date;
  teamAName: string;
  teamBName: string;
  sets: SetScore[];
}

export interface MatchRecordSummary {
  matchId: string;
  weekId: string;
  weekDate: Date;
  teamAName: string;
  teamBName: string;
  sets: SetScore[];
  winnerName: string;
  loserName: string;
  totalPointDiff: number;
  totalPoints: number;
}

function summarize(match: MatchRecordInput): MatchRecordSummary {
  const result = computeMatchResult(match.sets);
  const totalPointDiff = match.sets.reduce((sum, [a, b]) => sum + Math.abs(a - b), 0);
  const totalPoints = match.sets.reduce((sum, [a, b]) => sum + a + b, 0);
  const winnerName = result.winner === 'A' ? match.teamAName : match.teamBName;
  const loserName = result.winner === 'A' ? match.teamBName : match.teamAName;
  return {
    matchId: match.matchId,
    weekId: match.weekId,
    weekDate: match.weekDate,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    sets: match.sets,
    winnerName,
    loserName,
    totalPointDiff,
    totalPoints,
  };
}

export function findBiggestBlowout(matches: MatchRecordInput[]): MatchRecordSummary | null {
  if (matches.length === 0) return null;
  return matches.map(summarize).sort((a, b) => b.totalPointDiff - a.totalPointDiff)[0];
}

export function findClosestMatch(matches: MatchRecordInput[]): MatchRecordSummary | null {
  if (matches.length === 0) return null;
  return matches.map(summarize).sort((a, b) => a.totalPointDiff - b.totalPointDiff)[0];
}

export function findHighestScoringMatch(matches: MatchRecordInput[]): MatchRecordSummary | null {
  if (matches.length === 0) return null;
  return matches.map(summarize).sort((a, b) => b.totalPoints - a.totalPoints)[0];
}
