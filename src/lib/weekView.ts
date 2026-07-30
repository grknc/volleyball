import { prisma } from '@/lib/db';
import { computeMatchResult, isCompletedMatch, type MatchResult, type SetScore } from '@/lib/matchScoring';
import { computeStandings, type StandingsRow } from '@/lib/standings';
import type { WeekStatus } from '@/lib/constants';

export interface WeekViewData {
  id: string;
  date: Date;
  status: WeekStatus;
  attendeeCount: number;
  teamCount: number;
  matchCount: number;
  completedMatchCount: number;
  setCount: number;
  teams: {
    id: string;
    name: string;
    players: { id: string; name: string; level: number; avatarUrl: string | null; position: string | null }[];
  }[];
  matches: {
    id: string;
    teamAId: string;
    teamBId: string;
    sets: SetScore[];
    result: MatchResult | null;
  }[];
  standings: StandingsRow[];
  mvps: { id: string; name: string; avatarUrl: string | null; position: string | null }[];
}

export interface NextWeekSummary {
  id: string;
  date: Date;
  status: WeekStatus;
}

export async function getNextWeekSummary(afterDate: Date): Promise<NextWeekSummary | null> {
  const week = await prisma.week.findFirst({
    where: { date: { gt: afterDate }, status: { notIn: ['draft', 'archived'] } },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, status: true },
  });
  if (!week) return null;
  return { id: week.id, date: week.date, status: week.status as WeekStatus };
}

export async function getWeekView(weekId: string): Promise<WeekViewData | null> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
      _count: { select: { attendees: true } },
    },
  });
  if (!week) return null;

  const matches = week.matches.map((m) => {
    const sets = m.sets as SetScore[];
    const result = isCompletedMatch({ sets }) ? computeMatchResult(sets) : null;
    return { id: m.id, teamAId: m.teamAId, teamBId: m.teamBId, sets, result };
  });

  const playedMatches = matches.filter((m) => isCompletedMatch({ sets: m.sets }));
  const standings = computeStandings({
    teams: week.teams.map((t) => ({ id: t.id, name: t.name })),
    matches: playedMatches.map((m) => ({ teamAId: m.teamAId, teamBId: m.teamBId, sets: m.sets })),
  });

  return {
    id: week.id,
    date: week.date,
    status: week.status as WeekStatus,
    attendeeCount: week._count.attendees,
    teamCount: week.teams.length,
    matchCount: matches.length,
    completedMatchCount: playedMatches.length,
    setCount: playedMatches.reduce((sum, m) => sum + m.sets.length, 0),
    teams: week.teams.map((t) => ({
      id: t.id,
      name: t.name,
      players: t.players.map((p) => ({
        id: p.player.id,
        name: p.player.name,
        level: p.player.level,
        avatarUrl: p.player.avatarUrl,
        position: p.player.position,
      })),
    })),
    matches,
    standings,
    mvps: week.mvps.map((m) => ({
      id: m.player.id,
      name: m.player.name,
      avatarUrl: m.player.avatarUrl,
      position: m.player.position,
    })),
  };
}
