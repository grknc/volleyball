import { prisma } from '@/lib/db';
import { isCompletedMatch, type SetScore } from '@/lib/matchScoring';
import type { PlayerMatchAssignment } from '@/lib/playerStats';

export async function getPlayerMatchAssignments(
  weekIds?: string[]
): Promise<Map<string, PlayerMatchAssignment[]>> {
  const matches = await prisma.match.findMany({
    where: weekIds ? { weekId: { in: weekIds } } : undefined,
    include: {
      week: true,
      teamA: { include: { players: { select: { playerId: true } } } },
      teamB: { include: { players: { select: { playerId: true } } } },
    },
  });

  const byPlayer = new Map<string, PlayerMatchAssignment[]>();

  for (const match of matches) {
    const sets = match.sets as SetScore[];
    if (!isCompletedMatch({ sets })) continue;

    const base = {
      matchId: match.id,
      weekId: match.weekId,
      weekDate: match.week.date,
      matchCreatedAt: match.createdAt,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      sets,
    };

    for (const { playerId } of match.teamA.players) {
      const list = byPlayer.get(playerId) ?? [];
      list.push({ ...base, teamId: match.teamAId });
      byPlayer.set(playerId, list);
    }
    for (const { playerId } of match.teamB.players) {
      const list = byPlayer.get(playerId) ?? [];
      list.push({ ...base, teamId: match.teamBId });
      byPlayer.set(playerId, list);
    }
  }

  return byPlayer;
}
