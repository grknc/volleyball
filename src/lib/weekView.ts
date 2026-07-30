import { prisma } from '@/lib/db';
import { computeMatchResult, isCompletedMatch, type MatchResult, type SetScore } from '@/lib/matchScoring';
import { computeStandings, type StandingsRow } from '@/lib/standings';

export interface WeekViewData {
  id: string;
  date: Date;
  teams: { id: string; name: string; players: { id: string; name: string; level: number }[] }[];
  matches: {
    id: string;
    teamAId: string;
    teamBId: string;
    sets: SetScore[];
    result: MatchResult | null;
  }[];
  standings: StandingsRow[];
  mvps: { id: string; name: string }[];
}

export async function getWeekView(weekId: string): Promise<WeekViewData | null> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
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
    teams: week.teams.map((t) => ({
      id: t.id,
      name: t.name,
      players: t.players.map((p) => ({ id: p.player.id, name: p.player.name, level: p.player.level })),
    })),
    matches,
    standings,
    mvps: week.mvps.map((m) => ({ id: m.player.id, name: m.player.name })),
  };
}
