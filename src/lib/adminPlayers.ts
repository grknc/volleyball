import { prisma } from '@/lib/db';
import { refillWeek } from '@/lib/attendance';
import { getRatingSnapshot } from '@/lib/ratingService';

export interface AdminPlayerRow {
  id: string;
  name: string;
  level: number;
  rating: number;
  matches: number;
  weeks: number;
  mvps: number;
  position: string | null;
  heightCm: number | null;
  avatarUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function listAdminPlayers(): Promise<AdminPlayerRow[]> {
  const [players, snapshot] = await Promise.all([
    prisma.player.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { weekAttendances: true, mvps: true } } },
    }),
    getRatingSnapshot(),
  ]);
  return players.map((p) => {
    const state = snapshot.players.get(p.id);
    return {
      id: p.id,
      name: p.name,
      level: p.level,
      rating: state?.rating ?? p.level,
      matches: state?.matches ?? 0,
      weeks: p._count.weekAttendances,
      mvps: p._count.mvps,
      position: p.position,
      heightCm: p.heightCm,
      avatarUrl: p.avatarUrl,
      notes: p.notes,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    };
  });
}

export class PlayerHasHistoryError extends Error {
  constructor(public matches: number) {
    super(`Bu oyuncu ${matches} maçta oynadı.`);
  }
}

/**
 * Oyuncuyu kalıcı olarak siler. Katılım, takım, MVP, yedek ve "gelmiyorum" kayıtları
 * veritabanında cascade ile birlikte silinir.
 * Maç geçmişi olan oyuncu yalnızca force ile silinir (o maçların kadrosundan çıkar ve
 * diğer oyuncuların seviyeleri yeniden hesaplanır).
 */
export async function deletePlayer(playerId: string, { force = false } = {}): Promise<{ promoted: number }> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { weekAttendances: { select: { weekId: true } } },
  });
  if (!player) throw new Error('NOT_FOUND');

  if (!force) {
    const snapshot = await getRatingSnapshot();
    const matches = snapshot.players.get(playerId)?.matches ?? 0;
    if (matches > 0) throw new PlayerHasHistoryError(matches);
  }

  await prisma.player.delete({ where: { id: playerId } });

  // Kontenjanlı haftalarda boşalan yere sıradaki yedek geçsin.
  let promoted = 0;
  for (const { weekId } of player.weekAttendances) {
    promoted += await refillWeek(weekId);
  }
  return { promoted };
}
