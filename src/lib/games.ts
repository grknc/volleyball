import { CAPACITY_MAX, CAPACITY_MIN } from './capacity';
import { berlinLocalToUtc } from './berlinTime';

/**
 * "Oyun Bul / Oyun Oluştur" kuralları (saf fonksiyonlar, DB'den bağımsız).
 *
 * Yedek listesi saklanmaz: katılımcılar katılma sırasına göre dizilir,
 * ilk `capacity` kişi kesin, kalanı yedektir.
 */

export const GAME_STATUSES = ['searching', 'reserved', 'cancelled'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  searching: 'Oyuncu aranıyor',
  reserved: 'Saha rezerve edildi',
  cancelled: 'İptal edildi',
};

export function isGameStatus(value: unknown): value is GameStatus {
  return typeof value === 'string' && (GAME_STATUSES as readonly string[]).includes(value);
}

/** 10.000 € */
export const MAX_TOTAL_COST_CENTS = 1_000_000;

export function splitRoster<T>(ordered: T[], capacity: number): { confirmed: T[]; waitlist: T[] } {
  return { confirmed: ordered.slice(0, capacity), waitlist: ordered.slice(capacity) };
}

export interface CostBreakdown {
  /** Ödeyen kesin katılımcı sayısı */
  payers: number;
  /** Şu an kişi başı (ödeyen yoksa null) */
  perPersonCents: number | null;
  /** Kontenjan dolarsa kişi başı */
  perPersonWhenFullCents: number | null;
}

export function costBreakdown(args: {
  totalCostCents: number;
  capacity: number;
  confirmedCount: number;
  organizerFree: boolean;
}): CostBreakdown {
  const free = args.organizerFree ? 1 : 0;
  const payers = Math.max(0, args.confirmedCount - free);
  const payersWhenFull = args.capacity - free;
  return {
    payers,
    perPersonCents: payers > 0 ? Math.round(args.totalCostCents / payers) : null,
    perPersonWhenFullCents: payersWhenFull > 0 ? Math.round(args.totalCostCents / payersWhenFull) : null,
  };
}

/** "60", "60,5", "60.50" → kuruş. Geçersiz ya da sınır dışıysa null. */
export function parseEuroToCents(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = text.match(/^(\d{1,5})(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents <= MAX_TOTAL_COST_CENTS ? cents : null;
}

export function euroAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function formatEuro(cents: number): string {
  return `${euroAmount(cents)} €`;
}

/** Kırpar, ardışık boşlukları teke indirir; uzunluk sınır dışıysa null. */
export function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length >= min && text.length <= max ? text : null;
}

/**
 * Aynı oyunda aynı adın ikinci kez kullanılmasını engelleyen anahtar.
 * tr-TR "I"yı "ı" yapar; Almanca adlar (Ingo) da eşleşsin diye "ı" → "i".
 */
export function nameKey(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
}

export function isJoinOpen(status: string, startsAt: Date, now: Date): boolean {
  return status !== 'cancelled' && startsAt.getTime() > now.getTime();
}

export interface GameInput {
  venue: string;
  startsAt: Date;
  capacity: number;
  totalCostCents: number;
  organizerFree: boolean;
  organizerName: string;
  organizerContact: string;
  paymentNote: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function validateGameInput(
  raw: unknown,
  opts: { now: Date; requireFuture: boolean }
): Validation<GameInput> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('Geçersiz istek');
  const r = raw as Record<string, unknown>;

  const venue = cleanText(r.venue, 2, 120);
  if (!venue) return fail('Saha adı 2–120 karakter olmalı');

  const startsAt =
    typeof r.date === 'string' && typeof r.time === 'string' ? berlinLocalToUtc(r.date, r.time) : null;
  if (!startsAt) return fail('Geçerli bir tarih ve saat gerekli');
  if (opts.requireFuture && startsAt.getTime() <= opts.now.getTime()) {
    return fail('Oyun tarihi gelecekte olmalı');
  }

  const capacity = r.capacity;
  if (
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity < CAPACITY_MIN ||
    capacity > CAPACITY_MAX
  ) {
    return fail(`Oyuncu sayısı ${CAPACITY_MIN}–${CAPACITY_MAX} arasında bir tam sayı olmalı`);
  }

  const totalCostCents = parseEuroToCents(r.totalCost);
  if (totalCostCents === null) {
    return fail('Saha bedeli 0–10.000 € arasında olmalı (en fazla iki ondalık)');
  }

  if (r.organizerFree !== undefined && typeof r.organizerFree !== 'boolean') {
    return fail('Geçersiz "organizatör ödemez" değeri');
  }

  const organizerName = cleanText(r.organizerName, 2, 40);
  if (!organizerName) return fail('Organizatör adı 2–40 karakter olmalı');

  const organizerContact = cleanText(r.organizerContact, 3, 120);
  if (!organizerContact) return fail('İletişim bilgisi 3–120 karakter olmalı');

  let paymentNote: string | null = null;
  if (r.paymentNote !== undefined && r.paymentNote !== null) {
    if (typeof r.paymentNote !== 'string') return fail('Ödeme notu metin olmalı');
    if (r.paymentNote.trim() !== '') {
      paymentNote = cleanText(r.paymentNote, 1, 300);
      if (!paymentNote) return fail('Ödeme notu en fazla 300 karakter olabilir');
    }
  }

  return {
    ok: true,
    value: {
      venue,
      startsAt,
      capacity,
      totalCostCents,
      organizerFree: r.organizerFree === true,
      organizerName,
      organizerContact,
      paymentNote,
    },
  };
}

export interface GameParticipantView {
  id: string;
  name: string;
  isOrganizer: boolean;
}

/** Veritabanı satırı; `participants` katılma sırasına göre dizilmiş olmalı. */
export interface GameRow {
  id: string;
  venue: string;
  startsAt: Date;
  capacity: number;
  totalCostCents: number;
  organizerFree: boolean;
  organizerName: string;
  organizerContact: string;
  paymentNote: string | null;
  status: string;
  participants: GameParticipantView[];
}

export interface GameView {
  id: string;
  venue: string;
  /** ISO 8601 (UTC) */
  startsAt: string;
  capacity: number;
  totalCostCents: number;
  organizerFree: boolean;
  organizerName: string;
  organizerContact: string;
  paymentNote: string | null;
  status: GameStatus;
  confirmed: GameParticipantView[];
  waitlist: GameParticipantView[];
  cost: CostBreakdown;
  isFull: boolean;
  joinOpen: boolean;
}

export function buildGameView(row: GameRow, now: Date): GameView {
  const { confirmed, waitlist } = splitRoster(row.participants, row.capacity);
  const status: GameStatus = isGameStatus(row.status) ? row.status : 'searching';
  return {
    id: row.id,
    venue: row.venue,
    startsAt: row.startsAt.toISOString(),
    capacity: row.capacity,
    totalCostCents: row.totalCostCents,
    organizerFree: row.organizerFree,
    organizerName: row.organizerName,
    organizerContact: row.organizerContact,
    paymentNote: row.paymentNote,
    status,
    confirmed: confirmed.map(({ id, name, isOrganizer }) => ({ id, name, isOrganizer })),
    waitlist: waitlist.map(({ id, name, isOrganizer }) => ({ id, name, isOrganizer })),
    cost: costBreakdown({
      totalCostCents: row.totalCostCents,
      capacity: row.capacity,
      confirmedCount: confirmed.length,
      organizerFree: row.organizerFree,
    }),
    isFull: confirmed.length >= row.capacity,
    joinOpen: isJoinOpen(status, row.startsAt, now),
  };
}
