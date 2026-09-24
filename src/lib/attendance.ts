import { prisma } from '@/lib/db';
import { getRatingSnapshot, ratingOf } from '@/lib/ratingService';
import { suggestFormats, type FormatOption } from '@/lib/teamBalancer';
import {
  applyRsvp,
  fillFromWaitlist,
  isValidCapacity,
  type RosterState,
  type RsvpOutcome,
} from '@/lib/capacity';
import type { Prisma } from '@prisma/client';

/**
 * Katılım bildirimi:
 *  - "Geliyorum"  → WeekAttendee kaydı (takım önerisi, MVP vb. bunu kullanır);
 *                   kontenjan doluysa WeekWaitlist (yedek) kaydı
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
  /** null = sınırsız */
  capacity: number | null;
  coming: AttendancePlayer[];
  /** Yedekler, sıralı */
  waitlist: AttendancePlayer[];
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
        waitlist: { include: { player: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
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
  const waitIds = new Set(week.waitlist.map((w) => w.playerId));
  const notComingIds = new Set(week.absences.map((a) => a.playerId));
  const coming = week.attendees.map((a) => toPlayer(a.player)).sort(byName);
  const waitlist = week.waitlist.filter((w) => !comingIds.has(w.playerId)).map((w) => toPlayer(w.player));
  const notComing = week.absences
    .filter((a) => !comingIds.has(a.playerId) && !waitIds.has(a.playerId))
    .map((a) => toPlayer(a.player))
    .sort(byName);
  const noResponse = activePlayers
    .filter((p) => !comingIds.has(p.id) && !notComingIds.has(p.id) && !waitIds.has(p.id))
    .map(toPlayer)
    .sort(byName);

  return {
    weekId: week.id,
    weekDate: week.date.toISOString(),
    open: isRsvpOpen(week.status),
    teamsCreated: week.teams.length > 0,
    capacity: week.capacity,
    coming,
    waitlist,
    notComing,
    noResponse,
    lockedPlayerIds: week.teams.flatMap((t) => t.players.map((p) => p.playerId)),
    formats: suggestFormats(coming.length),
  };
}

async function readRoster(tx: Prisma.TransactionClient, weekId: string, capacity: number | null): Promise<RosterState> {
  const [attendees, waitlist, absences] = await Promise.all([
    tx.weekAttendee.findMany({ where: { weekId }, select: { playerId: true } }),
    tx.weekWaitlist.findMany({ where: { weekId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { playerId: true } }),
    tx.weekAbsence.findMany({ where: { weekId }, select: { playerId: true } }),
  ]);
  return {
    capacity,
    attendees: attendees.map((a) => a.playerId),
    waitlist: waitlist.map((w) => w.playerId),
    absences: absences.map((a) => a.playerId),
  };
}

/** Eski ve yeni durum arasındaki farkı DB'ye yazar. */
async function writeRoster(tx: Prisma.TransactionClient, weekId: string, before: RosterState, after: RosterState) {
  const diff = (a: string[], b: string[]) => a.filter((id) => !b.includes(id));

  const attendeeRemove = diff(before.attendees, after.attendees);
  const attendeeAdd = diff(after.attendees, before.attendees);
  const waitRemove = diff(before.waitlist, after.waitlist);
  const waitAdd = diff(after.waitlist, before.waitlist);
  const absRemove = diff(before.absences, after.absences);
  const absAdd = diff(after.absences, before.absences);

  if (attendeeRemove.length) await tx.weekAttendee.deleteMany({ where: { weekId, playerId: { in: attendeeRemove } } });
  if (waitRemove.length) await tx.weekWaitlist.deleteMany({ where: { weekId, playerId: { in: waitRemove } } });
  if (absRemove.length) await tx.weekAbsence.deleteMany({ where: { weekId, playerId: { in: absRemove } } });
  for (const playerId of attendeeAdd) await tx.weekAttendee.create({ data: { weekId, playerId } });
  // Yedekler sırayla eklenir (createdAt sırayı belirler)
  for (const playerId of waitAdd) await tx.weekWaitlist.create({ data: { weekId, playerId } });
  for (const playerId of absAdd) await tx.weekAbsence.create({ data: { weekId, playerId } });
}

export interface SetAttendanceResult {
  outcome: RsvpOutcome;
  waitlistPosition: number | null;
  promotedNames: string[];
}

export async function setAttendance(
  weekId: string,
  playerId: string,
  choice: RsvpChoice,
  { asAdmin = false }: { asAdmin?: boolean } = {}
): Promise<SetAttendanceResult> {
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

  const result = await prisma.$transaction(async (tx) => {
    const before = await readRoster(tx, weekId, week.capacity);
    const r = applyRsvp(before, playerId, choice, { asAdmin });
    await writeRoster(tx, weekId, before, r.state);
    return r;
  });

  const promoted = result.promoted.length
    ? await prisma.player.findMany({ where: { id: { in: result.promoted } }, select: { id: true, name: true } })
    : [];
  return {
    outcome: result.outcome,
    waitlistPosition: result.waitlistPosition,
    promotedNames: result.promoted.map((id) => promoted.find((p) => p.id === id)?.name ?? '?'),
  };
}

/** Yer açıldıysa (ör. bir katılımcı silindiğinde) yedekleri sırayla katılımcı yapar. */
export async function refillWeek(weekId: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const week = await tx.week.findUnique({ where: { id: weekId } });
    if (!week) return 0;
    const before = await readRoster(tx, weekId, week.capacity);
    const filled = fillFromWaitlist(before);
    await writeRoster(tx, weekId, before, filled.state);
    return filled.promoted.length;
  });
}

/** Kontenjanı değiştirir; yer açıldıysa yedekleri sırayla katılımcı yapar. */
export async function setWeekCapacity(weekId: string, capacity: unknown): Promise<{ promoted: number }> {
  if (!isValidCapacity(capacity)) {
    throw new AttendanceError('Kontenjan 4-60 arasında bir sayı ya da boş (sınırsız) olmalı', 400);
  }
  return prisma.$transaction(async (tx) => {
    const week = await tx.week.findUnique({ where: { id: weekId } });
    if (!week) throw new AttendanceError('Hafta bulunamadı', 404);
    await tx.week.update({ where: { id: weekId }, data: { capacity } });
    const before = await readRoster(tx, weekId, capacity);
    const filled = fillFromWaitlist(before);
    await writeRoster(tx, weekId, before, filled.state);
    return { promoted: filled.promoted.length };
  });
}
