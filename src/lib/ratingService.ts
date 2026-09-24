import { prisma } from '@/lib/db';
import { isCompletedMatch, type SetScore } from '@/lib/matchScoring';
import {
  runRatingEngine,
  type RatingEngineResult,
  type RatingMatchInput,
  type RatingPlayerInput,
} from '@/lib/rating';

export interface RatedPlayerInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: string | null;
  isActive: boolean;
  baseLevel: number;
}

export interface RatedMatchInfo {
  id: string;
  weekId: string;
  weekDate: Date;
  createdAt: Date;
  targetPoints: number | null;
  sets: SetScore[];
  teamA: { id: string; name: string; playerIds: string[] };
  teamB: { id: string; name: string; playerIds: string[] };
}

export interface RatingSnapshot extends RatingEngineResult {
  playersById: Map<string, RatedPlayerInfo>;
  matchesById: Map<string, RatedMatchInfo>;
  mvpsByPlayer: Map<string, Array<{ weekId: string; weekDate: Date }>>;
  /** Aktif ve en az 1 maç oynamış oyuncular, seviyeye göre azalan. */
  ranking: string[];
}

/**
 * Tüm tamamlanmış maçları DB'den okuyup seviye motorunu çalıştırır.
 * Arşivlenmiş haftalar da dahildir (geçmiş maçlar seviyeyi etkilemeye devam eder);
 * iptal edilen haftalar hariç tutulur.
 */
export async function getRatingSnapshot(): Promise<RatingSnapshot> {
  const [players, matches, mvps] = await Promise.all([
    prisma.player.findMany(),
    prisma.match.findMany({
      where: { week: { status: { not: 'cancelled' } } },
      include: {
        week: { select: { date: true } },
        teamA: { select: { id: true, name: true, players: { select: { playerId: true } } } },
        teamB: { select: { id: true, name: true, players: { select: { playerId: true } } } },
      },
    }),
    prisma.weeklyMvp.findMany({
      where: { week: { status: { not: 'cancelled' } } },
      include: { week: { select: { date: true } } },
    }),
  ]);

  const playersById = new Map<string, RatedPlayerInfo>(
    players.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        position: p.position,
        isActive: p.isActive,
        baseLevel: p.level,
      },
    ])
  );

  const matchesById = new Map<string, RatedMatchInfo>();
  for (const m of matches) {
    const sets = m.sets as SetScore[];
    if (!isCompletedMatch({ sets })) continue;
    matchesById.set(m.id, {
      id: m.id,
      weekId: m.weekId,
      weekDate: m.week.date,
      createdAt: m.createdAt,
      targetPoints: m.targetPoints,
      sets,
      teamA: { id: m.teamA.id, name: m.teamA.name, playerIds: m.teamA.players.map((p) => p.playerId) },
      teamB: { id: m.teamB.id, name: m.teamB.name, playerIds: m.teamB.players.map((p) => p.playerId) },
    });
  }

  const engine = runRatingEngine(
    players.map((p) => ({ id: p.id, baseLevel: p.level })),
    Array.from(matchesById.values()).map((m) => ({
      matchId: m.id,
      weekId: m.weekId,
      weekDate: m.weekDate,
      createdAt: m.createdAt,
      teamAId: m.teamA.id,
      teamBId: m.teamB.id,
      teamAPlayerIds: m.teamA.playerIds,
      teamBPlayerIds: m.teamB.playerIds,
      sets: m.sets,
    })),
    mvps.map((m) => ({ weekId: m.weekId, weekDate: m.week.date, playerId: m.playerId }))
  );

  const ranking = Array.from(engine.players.values())
    .filter((s) => s.matches > 0 && playersById.get(s.playerId)?.isActive)
    .sort((a, b) => b.rating - a.rating)
    .map((s) => s.playerId);

  const mvpsByPlayer = new Map<string, Array<{ weekId: string; weekDate: Date }>>();
  for (const m of mvps) {
    const list = mvpsByPlayer.get(m.playerId) ?? [];
    list.push({ weekId: m.weekId, weekDate: m.week.date });
    mvpsByPlayer.set(m.playerId, list);
  }

  return { ...engine, playersById, matchesById, mvpsByPlayer, ranking };
}

/** Motorun girdilerini snapshot'tan yeniden kurar (ör. seviye çözücü için). */
export function engineInputs(snapshot: RatingSnapshot): { players: RatingPlayerInput[]; matches: RatingMatchInput[] } {
  return {
    players: Array.from(snapshot.playersById.values()).map((p) => ({ id: p.id, baseLevel: p.baseLevel })),
    matches: Array.from(snapshot.matchesById.values()).map((m) => ({
      matchId: m.id,
      weekId: m.weekId,
      weekDate: m.weekDate,
      createdAt: m.createdAt,
      teamAId: m.teamA.id,
      teamBId: m.teamB.id,
      teamAPlayerIds: m.teamA.playerIds,
      teamBPlayerIds: m.teamB.playerIds,
      sets: m.sets,
    })),
  };
}

export function ratingOf(snapshot: RatingSnapshot, playerId: string): number {
  return snapshot.players.get(playerId)?.rating ?? snapshot.playersById.get(playerId)?.baseLevel ?? 5;
}
