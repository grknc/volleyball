import { prisma } from '@/lib/db';
import { getPlayerMatchAssignments } from '@/lib/matchAssignments';
import { computePlayerStats, countDistinctWeeks } from '@/lib/playerStats';

export interface PlayerPublicSummary {
  id: string;
  name: string;
  position: string | null;
  level: number;
  avatarUrl: string | null;
  isActive: boolean;
  weeksPlayed: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  mvpCount: number;
}

export interface PlayerListFilters {
  search?: string;
  position?: string;
  skillLevel?: number;
  sortBy?: 'name' | 'matches' | 'wins' | 'winRate' | 'mvps';
  order?: 'asc' | 'desc';
  minMatches?: number;
  limit?: number;
  offset?: number;
}

export interface PlayerListResult {
  players: PlayerPublicSummary[];
  total: number;
  limit: number;
  offset: number;
  minMatchesForWinRate: number;
}

const DEFAULT_MIN_MATCHES_FOR_WIN_RATE = 3;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function listPlayers(filters: PlayerListFilters): Promise<PlayerListResult> {
  const minMatches = filters.minMatches ?? DEFAULT_MIN_MATCHES_FOR_WIN_RATE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  const [players, assignmentsByPlayer, mvpGroups] = await Promise.all([
    prisma.player.findMany({ where: { isActive: true } }),
    getPlayerMatchAssignments(),
    prisma.weeklyMvp.groupBy({ by: ['playerId'], _count: { playerId: true } }),
  ]);

  const mvpCountMap = new Map(mvpGroups.map((g) => [g.playerId, g._count.playerId]));

  let summaries: PlayerPublicSummary[] = players.map((player) => {
    const stats = computePlayerStats(assignmentsByPlayer.get(player.id) ?? []);
    return {
      id: player.id,
      name: player.name,
      position: player.position,
      level: player.level,
      avatarUrl: player.avatarUrl,
      isActive: player.isActive,
      weeksPlayed: stats.weeksPlayed,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.winRate,
      mvpCount: mvpCountMap.get(player.id) ?? 0,
    };
  });

  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    summaries = summaries.filter((p) => p.name.toLowerCase().includes(term));
  }
  if (filters.position) {
    summaries = summaries.filter((p) => p.position === filters.position);
  }
  if (typeof filters.skillLevel === 'number') {
    summaries = summaries.filter((p) => p.level === filters.skillLevel);
  }

  const sortBy = filters.sortBy ?? 'name';
  if (sortBy === 'winRate') {
    summaries = summaries.filter((p) => p.matchesPlayed >= minMatches);
  }
  const order = filters.order ?? (sortBy === 'name' ? 'asc' : 'desc');
  const direction = order === 'asc' ? 1 : -1;

  summaries.sort((a, b) => {
    switch (sortBy) {
      case 'matches':
        return (a.matchesPlayed - b.matchesPlayed) * direction;
      case 'wins':
        return (a.wins - b.wins) * direction;
      case 'winRate':
        return (a.winRate - b.winRate) * direction;
      case 'mvps':
        return (a.mvpCount - b.mvpCount) * direction;
      case 'name':
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });

  const total = summaries.length;
  const page = summaries.slice(offset, offset + limit);

  return { players: page, total, limit, offset, minMatchesForWinRate: minMatches };
}

export interface PlayerDetail extends PlayerPublicSummary {
  heightCm: number | null;
  weeksRegistered: number;
  firstAttendedDate: string | null;
  lastAttendedDate: string | null;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  currentWinStreak: number;
  longestWinStreak: number;
  last10: Array<'W' | 'L'>;
  mvpWeeks: Array<{ weekId: string; weekDate: string }>;
  recentMatches: Array<{
    matchId: string;
    weekId: string;
    weekDate: string;
    teamName: string;
    opponentTeamName: string;
    sets: Array<[number, number]>;
    won: boolean;
  }>;
  teamsPlayedFor: Array<{ weekId: string; weekDate: string; teamId: string; teamName: string }>;
  weeksAttended: Array<{ weekId: string; weekDate: string }>;
  integrityWarnings: string[];
}

export async function getPlayerDetails(playerId: string): Promise<PlayerDetail | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      weekAttendances: { include: { week: true } },
      teamPlayers: { include: { team: { include: { week: true } } } },
      mvps: { include: { week: true } },
    },
  });
  if (!player) return null;

  const assignmentsByPlayer = await getPlayerMatchAssignments();
  const assignments = assignmentsByPlayer.get(playerId) ?? [];
  const stats = computePlayerStats(assignments);

  if (stats.integrityWarnings.length > 0) {
    // Data-integrity conflicts (e.g. a player rostered on both teams of one match) are a
    // server-side diagnostic signal, not public content — always log them so an admin can
    // investigate, but the API route (Task 10) and the page (Task 16) decide separately
    // whether integrityWarnings is included in what gets sent to the browser.
    console.warn(`[playerService] Oyuncu ${playerId} için veri bütünlüğü uyarıları:`, stats.integrityWarnings);
  }

  const teamNameById = new Map<string, string>();
  for (const tp of player.teamPlayers) {
    teamNameById.set(tp.team.id, tp.team.name);
  }
  const opponentTeamIds = Array.from(new Set(stats.records.map((r) => r.opponentTeamId)));
  const opponentTeams = await prisma.team.findMany({ where: { id: { in: opponentTeamIds } } });
  for (const team of opponentTeams) {
    teamNameById.set(team.id, team.name);
  }

  const setsByMatchId = new Map(assignments.map((a) => [a.matchId, a.sets as Array<[number, number]>]));

  const recentMatches = [...stats.records]
    .sort(
      (a, b) =>
        b.weekDate.getTime() - a.weekDate.getTime() ||
        b.matchCreatedAt.getTime() - a.matchCreatedAt.getTime()
    )
    .slice(0, 10)
    .map((r) => ({
      matchId: r.matchId,
      weekId: r.weekId,
      weekDate: r.weekDate.toISOString(),
      teamName: teamNameById.get(r.teamId) ?? 'Bilinmeyen Takım',
      opponentTeamName: teamNameById.get(r.opponentTeamId) ?? 'Bilinmeyen Takım',
      sets: setsByMatchId.get(r.matchId) ?? [],
      won: r.won,
    }));

  const weeksAttended = player.weekAttendances
    .map((wa) => ({ weekId: wa.weekId, weekDate: wa.week.date.toISOString() }))
    .sort((a, b) => a.weekDate.localeCompare(b.weekDate));

  const teamsPlayedFor = player.teamPlayers.map((tp) => ({
    weekId: tp.team.weekId,
    weekDate: tp.team.week.date.toISOString(),
    teamId: tp.team.id,
    teamName: tp.team.name,
  }));

  const mvpWeeks = player.mvps.map((m) => ({ weekId: m.weekId, weekDate: m.week.date.toISOString() }));

  const weeksRegistered = countDistinctWeeks(player.weekAttendances.map((wa) => wa.weekId));
  const attendedDates = weeksAttended.map((w) => w.weekDate);

  return {
    id: player.id,
    name: player.name,
    position: player.position,
    level: player.level,
    avatarUrl: player.avatarUrl,
    isActive: player.isActive,
    heightCm: player.heightCm,
    weeksPlayed: stats.weeksPlayed,
    weeksRegistered,
    firstAttendedDate: attendedDates[0] ?? null,
    lastAttendedDate: attendedDates[attendedDates.length - 1] ?? null,
    matchesPlayed: stats.matchesPlayed,
    wins: stats.wins,
    losses: stats.losses,
    winRate: stats.winRate,
    setsWon: stats.setsWon,
    setsLost: stats.setsLost,
    setDiff: stats.setDiff,
    currentWinStreak: stats.currentWinStreak,
    longestWinStreak: stats.longestWinStreak,
    last10: stats.last10,
    mvpCount: player.mvps.length,
    mvpWeeks,
    recentMatches,
    teamsPlayedFor,
    weeksAttended,
    integrityWarnings: stats.integrityWarnings,
  };
}
