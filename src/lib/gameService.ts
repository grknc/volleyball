import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateToken, hashToken, tokenMatches } from '@/lib/gameTokens';
import {
  buildGameView,
  cleanText,
  isJoinOpen,
  nameKey,
  parseNote,
  type GameInput,
  type GameStatus,
  type GameView,
} from '@/lib/games';

export class GameError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/** Katılma sırası: kesin/yedek ayrımı buna göre yapılır. */
const PARTICIPANT_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] satisfies Prisma.GameParticipantOrderByWithRelationInput[];

const VIEW_INCLUDE = {
  participants: {
    orderBy: PARTICIPANT_ORDER,
    select: { id: true, name: true, isOrganizer: true, note: true },
  },
} satisfies Prisma.GameInclude;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function gameData(input: GameInput) {
  return {
    venue: input.venue,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    capacity: input.capacity,
    totalCostCents: input.totalCostCents,
    organizerFree: input.organizerFree,
    organizerName: input.organizerName,
    organizerContact: input.organizerContact,
    paymentNote: input.paymentNote,
  };
}

export async function createGame(input: GameInput): Promise<{ id: string; manageToken: string }> {
  const manageToken = generateToken();
  const game = await prisma.game.create({
    data: {
      ...gameData(input),
      manageTokenHash: hashToken(manageToken),
      // Organizatör ilk katılımcıdır ve bir kontenjan kaplar.
      participants: {
        create: {
          name: input.organizerName,
          nameKey: nameKey(input.organizerName),
          note: input.organizerNote,
          isOrganizer: true,
        },
      },
    },
    select: { id: true },
  });
  return { id: game.id, manageToken };
}

export async function getGameView(id: string, now: Date = new Date()): Promise<GameView | null> {
  const game = await prisma.game.findUnique({ where: { id }, include: VIEW_INCLUDE });
  return game ? buildGameView(game, now) : null;
}

export async function listUpcomingGames(now: Date = new Date()): Promise<GameView[]> {
  const games = await prisma.game.findMany({
    where: { startsAt: { gte: now }, status: { not: 'cancelled' } },
    orderBy: { startsAt: 'asc' },
    include: VIEW_INCLUDE,
  });
  return games.map((game) => buildGameView(game, now));
}

export async function listAllGames(now: Date = new Date()): Promise<GameView[]> {
  const games = await prisma.game.findMany({ orderBy: { startsAt: 'desc' }, include: VIEW_INCLUDE });
  return games.map((game) => buildGameView(game, now));
}

export async function isManageTokenValid(id: string, token: unknown): Promise<boolean> {
  const game = await prisma.game.findUnique({ where: { id }, select: { manageTokenHash: true } });
  return !!game && tokenMatches(token, game.manageTokenHash);
}

export async function updateGame(
  id: string,
  manageToken: unknown,
  changes: { input?: GameInput; status?: GameStatus }
): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id }, select: { manageTokenHash: true } });
  if (!game) throw new GameError('Oyun bulunamadı', 404);
  if (!tokenMatches(manageToken, game.manageTokenHash)) {
    throw new GameError('Bu oyunu yönetme yetkiniz yok', 403);
  }

  const { input, status } = changes;
  try {
    await prisma.$transaction(async (tx) => {
      if (input) {
        await tx.game.update({ where: { id }, data: gameData(input) });
        // Organizatörün adı değiştiyse katılımcı satırı da güncellenir.
        await tx.gameParticipant.updateMany({
          where: { gameId: id, isOrganizer: true },
          data: { name: input.organizerName, nameKey: nameKey(input.organizerName), note: input.organizerNote },
        });
      }
      if (status) await tx.game.update({ where: { id }, data: { status } });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new GameError('Bu adla bir katılımcı zaten var. Farklı bir organizatör adı yazın.', 409);
    }
    throw err;
  }
}

export interface JoinResult {
  participantId: string;
  leaveToken: string;
  placement: 'confirmed' | 'waitlisted';
  /** Yedekse sırası (1'den başlar) */
  waitlistPosition: number | null;
}

export async function joinGame(
  id: string,
  rawName: unknown,
  rawNote: unknown,
  now: Date = new Date()
): Promise<JoinResult> {
  const name = cleanText(rawName, 2, 40);
  if (!name) throw new GameError('Ad 2–40 karakter olmalı', 400);
  const note = parseNote(rawNote);
  if (!note.ok) throw new GameError(note.error, 400);

  const game = await prisma.game.findUnique({
    where: { id },
    select: { status: true, startsAt: true, capacity: true },
  });
  if (!game) throw new GameError('Oyun bulunamadı', 404);
  if (!isJoinOpen(game.status, game.startsAt, now)) {
    throw new GameError('Bu oyuna artık katılınamıyor', 409);
  }

  const leaveToken = generateToken();
  let participantId: string;
  try {
    const created = await prisma.gameParticipant.create({
      data: { gameId: id, name, nameKey: nameKey(name), note: note.value, leaveTokenHash: hashToken(leaveToken) },
      select: { id: true },
    });
    participantId = created.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new GameError('Bu adla biri zaten katılmış. Farklı bir ad yazın.', 409);
    }
    throw err;
  }

  // Yer, kayıttan sonraki gerçek sıraya göre belirlenir; eşzamanlı
  // katılımlarda kontenjan aşılmaz, fazlası yedeğe düşer.
  const ordered = await prisma.gameParticipant.findMany({
    where: { gameId: id },
    orderBy: PARTICIPANT_ORDER,
    select: { id: true },
  });
  const index = ordered.findIndex((p) => p.id === participantId);
  const waitlisted = index >= game.capacity;
  return {
    participantId,
    leaveToken,
    placement: waitlisted ? 'waitlisted' : 'confirmed',
    waitlistPosition: waitlisted ? index - game.capacity + 1 : null,
  };
}

export async function removeParticipant(
  gameId: string,
  participantId: string,
  tokens: { leaveToken?: unknown; manageToken?: unknown }
): Promise<void> {
  const participant = await prisma.gameParticipant.findFirst({
    where: { id: participantId, gameId },
    select: { isOrganizer: true, leaveTokenHash: true, game: { select: { manageTokenHash: true } } },
  });
  if (!participant) throw new GameError('Katılımcı bulunamadı', 404);

  const allowed =
    tokenMatches(tokens.manageToken, participant.game.manageTokenHash) ||
    tokenMatches(tokens.leaveToken, participant.leaveTokenHash);
  if (!allowed) throw new GameError('Bu katılımcıyı çıkarma yetkiniz yok', 403);

  if (participant.isOrganizer) {
    throw new GameError('Organizatör oyundan çıkarılamaz. Oynamayacaksanız oyunu iptal edin.', 400);
  }
  await prisma.gameParticipant.deleteMany({ where: { id: participantId, gameId } });
}

export async function deleteGame(id: string): Promise<boolean> {
  const { count } = await prisma.game.deleteMany({ where: { id } });
  return count > 0;
}
