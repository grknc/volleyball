import { prisma } from '@/lib/db';
import { isCompletedMatch, type SetScore } from '@/lib/matchScoring';
import { computePlayerStats } from '@/lib/playerStats';
import { getPlayerMatchAssignments } from '@/lib/matchAssignments';
import {
  findBiggestBlowout,
  findClosestMatch,
  findHighestScoringMatch,
  type MatchRecordSummary,
} from '@/lib/matchRecords';

export type StatisticsScope =
  | { type: 'all' }
  | { type: 'last10' }
  | { type: 'week'; weekId: string };

export function parseStatisticsScope(
  params: URLSearchParams
): { scope: StatisticsScope } | { error: string } {
  const scope = params.get('scope') ?? 'all';
  if (scope === 'all') return { scope: { type: 'all' } };
  if (scope === 'last10') return { scope: { type: 'last10' } };
  if (scope === 'week') {
    const weekId = params.get('weekId');
    if (!weekId) return { error: 'week kapsamı için weekId gerekli' };
    return { scope: { type: 'week', weekId } };
  }
  return { error: 'Geçersiz scope değeri' };
}

async function getLastNPlayedWeekIds(n: number): Promise<string[]> {
  const weeks = await prisma.week.findMany({
    orderBy: { date: 'desc' },
    include: { matches: true },
  });
  return weeks
    .filter((w) => w.matches.some((m) => isCompletedMatch({ sets: m.sets as SetScore[] })))
    .slice(0, n)
    .map((w) => w.id);
}

async function resolveScopeWeekIds(scope: StatisticsScope): Promise<string[] | undefined> {
  if (scope.type === 'all') return undefined;
  if (scope.type === 'week') return [scope.weekId];
  return getLastNPlayedWeekIds(10);
}

export interface OverviewStats {
  totalPlayers: number;
  totalWeeks: number;
  totalMatches: number;
  totalSets: number;
  averageWeeklyAttendance: number;
  mostAttendedWeek: { weekId: string; weekDate: string; attendeeCount: number } | null;
}

export async function getOverview(scope: StatisticsScope): Promise<OverviewStats> {
  const weekIds = await resolveScopeWeekIds(scope);

  const [weeks, totalPlayers] = await Promise.all([
    prisma.week.findMany({
      where: weekIds ? { id: { in: weekIds } } : undefined,
      include: { matches: true, attendees: true },
    }),
    prisma.player.count({ where: { isActive: true } }),
  ]);

  const completedMatches = weeks.flatMap((w) =>
    w.matches.filter((m) => isCompletedMatch({ sets: m.sets as SetScore[] }))
  );
  const totalSets = completedMatches.reduce((sum, m) => sum + (m.sets as SetScore[]).length, 0);

  const attendanceCounts = weeks.map((w) => ({
    weekId: w.id,
    weekDate: w.date.toISOString(),
    attendeeCount: w.attendees.length,
  }));
  const averageWeeklyAttendance =
    weeks.length > 0
      ? attendanceCounts.reduce((sum, a) => sum + a.attendeeCount, 0) / weeks.length
      : 0;
  const mostAttendedWeek =
    attendanceCounts.length > 0
      ? attendanceCounts.reduce((max, a) => (a.attendeeCount > max.attendeeCount ? a : max))
      : null;

  return {
    totalPlayers,
    totalWeeks: weeks.length,
    totalMatches: completedMatches.length,
    totalSets,
    averageWeeklyAttendance,
    mostAttendedWeek,
  };
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  value: number;
}

export interface PlayerLeaderboards {
  minMatchesForWinRate: number;
  mostMatches: LeaderboardEntry[];
  mostWins: LeaderboardEntry[];
  highestWinRate: LeaderboardEntry[];
  mostMvps: LeaderboardEntry[];
  mostWeeksPlayed: LeaderboardEntry[];
  mostSetsWon: LeaderboardEntry[];
  bestSetDiff: LeaderboardEntry[];
}

const LEADERBOARD_SIZE = 10;
const DEFAULT_MIN_MATCHES_FOR_WIN_RATE = 3;

export async function getPlayerLeaderboards(scope: StatisticsScope): Promise<PlayerLeaderboards> {
  const weekIds = await resolveScopeWeekIds(scope);

  const [players, assignmentsByPlayer, mvpGroups] = await Promise.all([
    prisma.player.findMany({ where: { isActive: true } }),
    getPlayerMatchAssignments(weekIds),
    prisma.weeklyMvp.groupBy({
      by: ['playerId'],
      _count: { playerId: true },
      where: weekIds ? { weekId: { in: weekIds } } : undefined,
    }),
  ]);
  const mvpCountMap = new Map(mvpGroups.map((g) => [g.playerId, g._count.playerId]));

  const rows = players.map((player) => {
    const stats = computePlayerStats(assignmentsByPlayer.get(player.id) ?? []);
    return {
      playerId: player.id,
      name: player.name,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      winRate: stats.winRate,
      mvpCount: mvpCountMap.get(player.id) ?? 0,
      weeksPlayed: stats.weeksPlayed,
      setsWon: stats.setsWon,
      setDiff: stats.setDiff,
    };
  });

  function top(metric: (r: (typeof rows)[number]) => number, minMatches = 0): LeaderboardEntry[] {
    return rows
      .filter((r) => r.matchesPlayed >= minMatches)
      .map((r) => ({ playerId: r.playerId, name: r.name, value: metric(r) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, LEADERBOARD_SIZE);
  }

  return {
    minMatchesForWinRate: DEFAULT_MIN_MATCHES_FOR_WIN_RATE,
    mostMatches: top((r) => r.matchesPlayed),
    mostWins: top((r) => r.wins),
    highestWinRate: top((r) => r.winRate, DEFAULT_MIN_MATCHES_FOR_WIN_RATE),
    mostMvps: top((r) => r.mvpCount),
    mostWeeksPlayed: top((r) => r.weeksPlayed),
    mostSetsWon: top((r) => r.setsWon),
    bestSetDiff: top((r) => r.setDiff),
  };
}

export interface TeamMatchRecords {
  biggestBlowout: MatchRecordSummary | null;
  closestMatch: MatchRecordSummary | null;
  highestScoringMatch: MatchRecordSummary | null;
}

export async function getMatchRecords(scope: StatisticsScope): Promise<TeamMatchRecords> {
  const weekIds = await resolveScopeWeekIds(scope);

  const matches = await prisma.match.findMany({
    where: weekIds ? { weekId: { in: weekIds } } : undefined,
    include: { week: true, teamA: true, teamB: true },
  });

  const inputs = matches
    .filter((m) => isCompletedMatch({ sets: m.sets as SetScore[] }))
    .map((m) => ({
      matchId: m.id,
      weekId: m.weekId,
      weekDate: m.week.date,
      teamAName: m.teamA.name,
      teamBName: m.teamB.name,
      sets: m.sets as SetScore[],
    }));

  return {
    biggestBlowout: findBiggestBlowout(inputs),
    closestMatch: findClosestMatch(inputs),
    highestScoringMatch: findHighestScoringMatch(inputs),
  };
}
