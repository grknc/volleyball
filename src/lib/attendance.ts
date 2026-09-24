import { prisma } from '@/lib/db';
import { getRatingSnapshot, ratingOf } from '@/lib/ratingService';
import { suggestFormats, type FormatOption } from '@/lib/teamBalancer';

/**
 * Katılım bildirimi:
 *  - "Geliyorum"  → WeekAttendee kaydı (takım önerisi, MVP vb. bunu kullanır)
 *  - "Gelmiyorum" → WeekAbsence kaydı
 *  - Yanıt yok    → ikisi de yok
 */

export const RSVP_CHOICES = ['yes', 'no', 'none'] as const;
export type RsvpChoice = (typeof RSVP_CHOICES)[number];

export function isRsvpChoice(value: unknown): value is RsvpChoice {
  return typeof value === 'string' && (RSVP_CHOICES as readonly string[]).includes(value);
}

export interface AttendancePlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: string | null;
  rating: number;
}

export interface WeekAttendance {
  weekId: string;
  weekDate: string;
  /** Oyuncular kendi katılımını değiştirebilir mi? */
  open: boolean;
  teamsCreated: boolean;
  coming: AttendancePlayer[];
  notComing: AttendancePlayer[];
  noResponse: AttendancePlayer[];
  /** Takıma yerleştirilmiş oyuncular (bunlar herkese açık ekrandan katılım değiştiremez) */
  lockedPlayerIds: string[];
  formats: FormatOption[];
}

export class AttendanceError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function isRsvpOpen(status: string): boolean {
  return status === 'published';
}

export async function getWeekAttendance(weekId: string): Promise<WeekAttendance | null> {
  const [week, activePlayers, snapshot] = await Promise.all([
    prisma.week.findUnique({
      where: { id: weekId },
      include: {
        attendees: { include: { player: true } },
        absences: { include: { player: true } },
        teams: { include: { players: { select: { playerId: true } } } },
      },
    }),
    prisma.player.findMany({ where: { isActive: true } }),
    getRatingSnapshot(),
  ]);
  if (!week) return null;

  const toPlayer = (p: { id: string; name: string; avatarUrl: string | null; position: string | null }) => ({
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    position: p.position,
    rating: ratingOf(snapshot, p.id),
  });
  const byName = (a: AttendancePlayer, b: AttendancePlayer) => a.name.localeCompare(b.name, 'tr');

  const comingIds = new Set(week.attendees.map((a) => a.playerId));
  const notComingIds = new Set(week.absences.map((a) => a.playerId));
  const coming = week.attendees.map((a) => toPlayer(a.player)).sort(byName);
  const notComing = week.absences
    .filter((a) => !comingIds.has(a.playerId))
    .map((a) => toPlayer(a.player))
    .sort(byName);
  const noResponse = activePlayers
    .filter((p) => !comingIds.has(p.id) && !notComingIds.has(p.id))
    .map(toPlayer)
    .sort(byName);

  return {
    weekId: week.id,
    weekDate: week.date.toISOString(),
    open: isRsvpOpen(week.status),
    teamsCreated: week.teams.length > 0,
    coming,
    notComing,
    noResponse,
    lockedPlayerIds: week.teams.flatMap((t) => t.players.map((p) => p.playerId)),
    formats: suggestFormats(coming.length),
  };
}

export async function setAttendance(
  weekId: string,
  playerId: string,
  choice: RsvpChoice,
  { asAdmin = false }: { asAdmin?: boolean } = {}
): Promise<void> {
  const [week, player] = await Promise.all([
    prisma.week.findUnique({
      where: { id: weekId },
      include: { teams: { include: { players: { select: { playerId: true } } } } },
    }),
    prisma.player.findUnique({ where: { id: playerId } }),
  ]);
  if (!week) throw new AttendanceError('Hafta bulunamadı', 404);
  if (!player) throw new AttendanceError('Oyuncu bulunamadı', 404);

  if (!asAdmin) {
    if (!isRsvpOpen(week.status)) {
      throw new AttendanceError('Bu hafta için katılım bildirimi kapalı', 403);
    }
    if (!player.isActive) {
      throw new AttendanceError('Pasif oyuncular katılım bildiremez', 403);
    }
    const onTeam = week.teams.some((t) => t.players.some((p) => p.playerId === playerId));
    if (onTeam) {
      throw new AttendanceError(
        'Takımlar kuruldu ve bu oyuncu bir takımda. Değişiklik için organizatöre haber ver.',
        409
      );
    }
  }

  const key = { weekId_playerId: { weekId, playerId } };
  await prisma.$transaction(async (tx) => {
    if (choice === 'yes') {
      await tx.weekAbsence.deleteMany({ where: { weekId, playerId } });
      await tx.weekAttendee.upsert({ where: key, create: { weekId, playerId }, update: {} });
    } else if (choice === 'no') {
      await tx.weekAttendee.deleteMany({ where: { weekId, playerId } });
      await tx.weekAbsence.upsert({ where: key, create: { weekId, playerId }, update: {} });
    } else {
      await tx.weekAttendee.deleteMany({ where: { weekId, playerId } });
      await tx.weekAbsence.deleteMany({ where: { weekId, playerId } });
    }
  });
}
