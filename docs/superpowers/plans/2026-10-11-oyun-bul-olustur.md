# Oyun Bul / Oyun Oluştur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone with the link create a volleyball game (venue, date, time, capacity, total court cost) and let others join/leave it by name, with an automatic waitlist, a live per-person price, an organizer manage link and a copyable share link — no user accounts.

**Architecture:** Two new Prisma models (`Game`, `GameParticipant`), independent of `Week`/`Player`. The waitlist is not stored: participants ordered by `(createdAt, id)` are split at `capacity`. All rules (roster split, cost, validation, view building, Berlin time conversion, tokens) are pure functions under `src/lib` with unit tests; `gameService.ts` is a thin Prisma layer; API routes are thin wrappers; pages are `force-dynamic` server components with small client components for forms and buttons. Authority comes from random tokens whose SHA-256 hashes are stored: a manage token for the organizer, a leave token per participant, both kept in the browser's `localStorage`.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / PostgreSQL, TypeScript, Vitest 2, Tailwind (no component library). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-oyun-bul-olustur-design.md`

## Global Constraints

- No new npm dependencies.
- Existing models (`Week`, `Player`, …) and their tables are not modified. Games never feed statistics or ratings.
- Currency is €, stored as integer cents (`totalCostCents`). Time zone is `Europe/Berlin` for both input and display; the server runs in UTC.
- Capacity limits come from `CAPACITY_MIN` / `CAPACITY_MAX` in `src/lib/capacity.ts` (4–60). Total cost 0–10 000 €, max two decimals, comma or dot. Names 2–40 chars, venue 2–120, contact 3–120, payment note optional ≤ 300.
- Per-person price = `totalCostCents / payers`, `payers = confirmed − (organizerFree ? 1 : 0)`, rounded to the nearest cent; not shown when `payers = 0`. Waitlisted people never count as payers.
- Statuses are exactly `searching` ("Oyuncu aranıyor"), `reserved` ("Saha rezerve edildi"), `cancelled` ("İptal edildi"). Only the organizer changes status. Reaching capacity does not change status.
- Joining is closed when status is `cancelled` or `startsAt` has passed; leaving stays possible.
- The organizer is the first participant, takes a slot, and can neither leave nor be removed.
- Tokens are 32 random bytes (base64url). Only SHA-256 hashes are stored; comparison is constant-time. Tokens are never logged and never returned after creation.
- All user-visible text is Turkish. User-supplied text is rendered as plain text only (no `dangerouslySetInnerHTML`, no auto-linking).
- API errors use the existing shape `{ error: '<Türkçe mesaj>' }` with 400 / 403 / 404 / 409. Raw Prisma errors are never returned.
- `npm test` must not touch a database.
- Work happens on branch `oyun-bul-olustur`. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **`DATABASE_URL` in `.env` may be the production database.** Never run `prisma migrate dev` or `prisma migrate reset`. The only DB command in this plan is `prisma migrate deploy` in Task 4, and it requires the user's explicit go-ahead.

## Review Focus

1. **Double click / double submit on "Katıl"** — a person expects to appear once. Pinned by the `(gameId, nameKey)` unique constraint (Task 4), the 409 mapping in `joinGame` (Task 5) and the disabled-while-busy button (Task 7).
2. **Turkish casing and stray spaces in names** — "İpek", "ipek" and "  İpek  " are the same person. Pinned by `nameKey` / `cleanText` tests (Task 2).
3. **Organizer lowers capacity below the number already confirmed** — the latest joiners move to the waitlist and the price is recomputed, nobody disappears. Pinned by `splitRoster` and `buildGameView` tests (Task 2).
4. **Malformed request bodies** (not JSON, array, capacity as string `"12"`, cost `"abc"`, negative or three-decimal cost) — a 400 with a readable message, never a 500. Pinned by `validateGameInput` / `parseEuroToCents` tests (Task 2) and `.catch(() => null)` on every `request.json()` (Task 6).
5. **Dates that do not exist or are ambiguous in Berlin** (30 February, 02:30 on the spring-forward night, 02:30 on the fall-back night) and **`localStorage` being unavailable** (private mode) — invalid dates are rejected, the ambiguous one is accepted and round-trips; joining still works without storage, only the "Ayrıl" button is lost after reload. Pinned by `berlinTime` tests (Task 1) and try/catch in `gameStorage.ts` (Task 7).

---

## File Map

| File | Responsibility |
|---|---|
| `src/lib/berlinTime.ts` | Berlin local date+time ⇄ UTC, display formatting |
| `src/lib/games.ts` | Pure rules: statuses, roster split, cost, parsing, validation, view building |
| `src/lib/gameTokens.ts` | Token generation, hashing, constant-time match |
| `src/lib/gameService.ts` | Prisma access for games |
| `src/lib/gameHttp.ts` | `GameError` → `NextResponse` |
| `src/lib/gameStorage.ts` | Browser `localStorage` helpers (client only) |
| `src/app/api/games/**` | Public game API |
| `src/app/api/admin/games/[id]/route.ts` | Admin delete |
| `src/app/oyunlar/**` | Public pages |
| `src/app/admin/oyunlar/page.tsx` | Admin list |
| `src/components/Game*.tsx`, `CopyLinkButton.tsx`, `AdminGameDeleteButton.tsx` | UI |

---

### Task 1: Berlin time helpers

**Files:**
- Create: `src/lib/berlinTime.ts`
- Test: `src/lib/berlinTime.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GAME_TIME_ZONE: 'Europe/Berlin'`
  - `berlinLocalToUtc(date: string, time: string): Date | null` — `date` is `YYYY-MM-DD`, `time` is `HH:MM`; `null` when malformed or when that local time does not exist.
  - `berlinParts(instant: Date): { date: string; time: string }`
  - `formatGameDate(value: Date | string): string`

- [ ] **Step 1: Write the failing test**

`src/lib/berlinTime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { berlinLocalToUtc, berlinParts, formatGameDate } from './berlinTime';

describe('berlinLocalToUtc', () => {
  it('converts winter time (UTC+1)', () => {
    expect(berlinLocalToUtc('2026-11-14', '19:00')?.toISOString()).toBe('2026-11-14T18:00:00.000Z');
  });

  it('converts summer time (UTC+2)', () => {
    expect(berlinLocalToUtc('2026-07-14', '19:00')?.toISOString()).toBe('2026-07-14T17:00:00.000Z');
  });

  it('handles midnight without rolling the day', () => {
    expect(berlinLocalToUtc('2026-11-14', '00:00')?.toISOString()).toBe('2026-11-13T23:00:00.000Z');
  });

  it('rejects a local time skipped by the spring-forward change', () => {
    expect(berlinLocalToUtc('2026-03-29', '02:30')).toBeNull();
  });

  it('accepts the hour right after the spring-forward change', () => {
    expect(berlinLocalToUtc('2026-03-29', '03:30')?.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('accepts an ambiguous fall-back time and round-trips it', () => {
    const utc = berlinLocalToUtc('2026-10-25', '02:30');
    expect(utc).not.toBeNull();
    expect(berlinParts(utc!)).toEqual({ date: '2026-10-25', time: '02:30' });
  });

  it.each([
    ['2026-02-30', '10:00'],
    ['2026-13-01', '10:00'],
    ['2026-11-14', '25:00'],
    ['2026-11-14', '24:00'],
    ['14.11.2026', '19:00'],
    ['2026-11-14', '7pm'],
    ['', ''],
  ])('rejects %s %s', (date, time) => {
    expect(berlinLocalToUtc(date, time)).toBeNull();
  });
});

describe('berlinParts', () => {
  it('returns the Berlin wall-clock date and time', () => {
    expect(berlinParts(new Date('2026-07-14T22:30:00.000Z'))).toEqual({ date: '2026-07-15', time: '00:30' });
  });
});

describe('formatGameDate', () => {
  it('formats in Turkish using Berlin time', () => {
    const text = formatGameDate('2026-11-14T18:00:00.000Z');
    expect(text).toContain('19:00');
    expect(text).toContain('Kasım');
    expect(text).toContain('14');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/berlinTime.test.ts`
Expected: FAIL — cannot resolve `./berlinTime`.

- [ ] **Step 3: Write the implementation**

`src/lib/berlinTime.ts`:

```ts
/**
 * Oyun tarih/saatleri Europe/Berlin yerel saati olarak girilir ve gösterilir;
 * veritabanında UTC tutulur. Sunucu UTC'de çalıştığı için dönüşüm burada
 * açıkça yapılır (yeni bağımlılık yok, yaz/kış saati Intl'den gelir).
 */
export const GAME_TIME_ZONE = 'Europe/Berlin';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: GAME_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const DISPLAY = new Intl.DateTimeFormat('tr-TR', {
  timeZone: GAME_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function berlinParts(instant: Date): { date: string; time: string } {
  const p: Record<string, string> = {};
  for (const part of PARTS.formatToParts(instant)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Berlin'in o andaki UTC farkı (ms). */
function offsetMs(instant: Date): number {
  const { date, time } = berlinParts(instant);
  const wallClockAsUtc = Date.parse(`${date}T${time}:00Z`);
  return wallClockAsUtc - Math.floor(instant.getTime() / 60000) * 60000;
}

export function berlinLocalToUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(guess)) return null;
  // İlk tahminle farkı bul, sonra bulunan an için farkı yeniden hesapla
  // (yaz/kış saati geçişinin iki yanında fark değişir).
  const firstPass = guess - offsetMs(new Date(guess));
  const result = new Date(guess - offsetMs(new Date(firstPass)));
  // Var olmayan tarih (30 Şubat) ya da atlanan saat (ileri alınan gece) geri
  // çevrildiğinde aynı değeri vermez.
  const back = berlinParts(result);
  return back.date === date && back.time === time ? result : null;
}

export function formatGameDate(value: Date | string): string {
  return DISPLAY.format(new Date(value));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/berlinTime.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/berlinTime.ts src/lib/berlinTime.test.ts
git commit -m "feat(oyunlar): Berlin saat dilimi yardimcilari"
```

---

### Task 2: Pure game rules

**Files:**
- Create: `src/lib/games.ts`
- Test: `src/lib/games.test.ts`

**Interfaces:**
- Consumes: `berlinLocalToUtc` from Task 1; `CAPACITY_MIN`, `CAPACITY_MAX` from `src/lib/capacity.ts`.
- Produces (all exported from `src/lib/games.ts`):
  - `GAME_STATUSES`, `type GameStatus = 'searching' | 'reserved' | 'cancelled'`, `GAME_STATUS_LABELS: Record<GameStatus, string>`, `isGameStatus(value: unknown): value is GameStatus`
  - `MAX_TOTAL_COST_CENTS = 1_000_000`
  - `splitRoster<T>(ordered: T[], capacity: number): { confirmed: T[]; waitlist: T[] }`
  - `interface CostBreakdown { payers: number; perPersonCents: number | null; perPersonWhenFullCents: number | null }`
  - `costBreakdown(args: { totalCostCents: number; capacity: number; confirmedCount: number; organizerFree: boolean }): CostBreakdown`
  - `parseEuroToCents(value: unknown): number | null`
  - `euroAmount(cents: number): string` → `"60,00"`; `formatEuro(cents: number): string` → `"60,00 €"`
  - `cleanText(value: unknown, min: number, max: number): string | null`
  - `nameKey(name: string): string`
  - `isJoinOpen(status: string, startsAt: Date, now: Date): boolean`
  - `interface GameInput { venue: string; startsAt: Date; capacity: number; totalCostCents: number; organizerFree: boolean; organizerName: string; organizerContact: string; paymentNote: string | null }`
  - `type Validation<T> = { ok: true; value: T } | { ok: false; error: string }`
  - `validateGameInput(raw: unknown, opts: { now: Date; requireFuture: boolean }): Validation<GameInput>` — `raw` fields: `venue`, `date`, `time`, `capacity` (number), `totalCost` (string or number), `organizerFree` (boolean, optional), `organizerName`, `organizerContact`, `paymentNote` (optional)
  - `interface GameParticipantView { id: string; name: string; isOrganizer: boolean }`
  - `interface GameRow { id: string; venue: string; startsAt: Date; capacity: number; totalCostCents: number; organizerFree: boolean; organizerName: string; organizerContact: string; paymentNote: string | null; status: string; participants: GameParticipantView[] }` — `participants` already ordered by join time
  - `interface GameView { id: string; venue: string; startsAt: string; capacity: number; totalCostCents: number; organizerFree: boolean; organizerName: string; organizerContact: string; paymentNote: string | null; status: GameStatus; confirmed: GameParticipantView[]; waitlist: GameParticipantView[]; cost: CostBreakdown; isFull: boolean; joinOpen: boolean }` — `startsAt` is an ISO string so the view can cross the server/client boundary
  - `buildGameView(row: GameRow, now: Date): GameView`

- [ ] **Step 1: Write the failing test**

`src/lib/games.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildGameView,
  cleanText,
  costBreakdown,
  euroAmount,
  formatEuro,
  isGameStatus,
  isJoinOpen,
  nameKey,
  parseEuroToCents,
  splitRoster,
  validateGameInput,
  type GameRow,
} from './games';

const NOW = new Date('2026-10-11T10:00:00.000Z');

const rawGame = (over: Record<string, unknown> = {}) => ({
  venue: 'Sporthalle Nord',
  date: '2026-11-14',
  time: '19:00',
  capacity: 12,
  totalCost: '60',
  organizerFree: true,
  organizerName: 'Deniz',
  organizerContact: 'WhatsApp 0151 000000',
  paymentNote: 'PayPal: deniz@example.com',
  ...over,
});

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Oyuncu ${i}`, isOrganizer: i === 0 }));

const row = (over: Partial<GameRow> = {}): GameRow => ({
  id: 'g1',
  venue: 'Sporthalle Nord',
  startsAt: new Date('2026-11-14T18:00:00.000Z'),
  capacity: 12,
  totalCostCents: 6000,
  organizerFree: true,
  organizerName: 'Deniz',
  organizerContact: 'WhatsApp 0151 000000',
  paymentNote: null,
  status: 'searching',
  participants: people(8),
  ...over,
});

describe('splitRoster', () => {
  it('keeps everyone confirmed below capacity', () => {
    expect(splitRoster(['a', 'b'], 4)).toEqual({ confirmed: ['a', 'b'], waitlist: [] });
  });

  it('fills exactly to capacity with an empty waitlist', () => {
    expect(splitRoster(['a', 'b', 'c', 'd'], 4)).toEqual({ confirmed: ['a', 'b', 'c', 'd'], waitlist: [] });
  });

  it('puts later joiners on the waitlist in order', () => {
    expect(splitRoster(['a', 'b', 'c', 'd', 'e', 'f'], 4)).toEqual({
      confirmed: ['a', 'b', 'c', 'd'],
      waitlist: ['e', 'f'],
    });
  });

  it('promotes the first waitlisted person when someone leaves', () => {
    const afterLeave = ['a', 'c', 'd', 'e', 'f'];
    expect(splitRoster(afterLeave, 4)).toEqual({ confirmed: ['a', 'c', 'd', 'e'], waitlist: ['f'] });
  });

  it('moves the latest joiners to the waitlist when capacity is lowered', () => {
    expect(splitRoster(['a', 'b', 'c', 'd', 'e', 'f'], 5).waitlist).toEqual(['f']);
    expect(splitRoster(['a', 'b', 'c', 'd', 'e', 'f'], 4).waitlist).toEqual(['e', 'f']);
  });
});

describe('costBreakdown', () => {
  it('matches the spec example: 60 €, 12 slots, organizer free, 8 confirmed', () => {
    expect(costBreakdown({ totalCostCents: 6000, capacity: 12, confirmedCount: 8, organizerFree: true })).toEqual({
      payers: 7,
      perPersonCents: 857,
      perPersonWhenFullCents: 545,
    });
  });

  it('counts the organizer as a payer when not free', () => {
    expect(costBreakdown({ totalCostCents: 6000, capacity: 12, confirmedCount: 8, organizerFree: false })).toEqual({
      payers: 8,
      perPersonCents: 750,
      perPersonWhenFullCents: 500,
    });
  });

  it('shows no per-person price when only a free organizer has joined', () => {
    const cost = costBreakdown({ totalCostCents: 6000, capacity: 12, confirmedCount: 1, organizerFree: true });
    expect(cost.payers).toBe(0);
    expect(cost.perPersonCents).toBeNull();
    expect(cost.perPersonWhenFullCents).toBe(545);
  });

  it('charges a lone paying organizer the full amount', () => {
    expect(
      costBreakdown({ totalCostCents: 6000, capacity: 12, confirmedCount: 1, organizerFree: false }).perPersonCents
    ).toBe(6000);
  });

  it('is zero for a free game', () => {
    const cost = costBreakdown({ totalCostCents: 0, capacity: 12, confirmedCount: 5, organizerFree: false });
    expect(cost.perPersonCents).toBe(0);
    expect(cost.perPersonWhenFullCents).toBe(0);
  });
});

describe('parseEuroToCents', () => {
  it.each([
    ['60', 6000],
    ['60,5', 6050],
    ['60.50', 6050],
    [' 7,05 ', 705],
    ['0', 0],
    ['10000', 1000000],
    [60, 6000],
    [60.5, 6050],
  ])('parses %s', (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  it.each([['abc'], [''], ['-5'], ['60,505'], ['10000,01'], ['100000'], ['1e3'], ['60 €'], [null], [undefined], [{}], [NaN]])(
    'rejects %s',
    (input) => {
      expect(parseEuroToCents(input)).toBeNull();
    }
  );
});

describe('euro formatting', () => {
  it('formats cents with a comma', () => {
    expect(euroAmount(6000)).toBe('60,00');
    expect(formatEuro(857)).toBe('8,57 €');
    expect(formatEuro(5)).toBe('0,05 €');
  });
});

describe('cleanText', () => {
  it('trims and collapses whitespace', () => {
    expect(cleanText('  Ali   Veli \n', 2, 40)).toBe('Ali Veli');
  });

  it('enforces length after trimming', () => {
    expect(cleanText(' a ', 2, 40)).toBeNull();
    expect(cleanText('ab', 2, 40)).toBe('ab');
    expect(cleanText('x'.repeat(41), 2, 40)).toBeNull();
    expect(cleanText('x'.repeat(40), 2, 40)).toBe('x'.repeat(40));
  });

  it('rejects non-strings', () => {
    expect(cleanText(42, 2, 40)).toBeNull();
    expect(cleanText(null, 2, 40)).toBeNull();
  });
});

describe('nameKey', () => {
  it('treats Turkish dotted capital İ like i', () => {
    expect(nameKey('İpek')).toBe(nameKey('ipek'));
    expect(nameKey('ALİ')).toBe(nameKey('ali'));
  });

  it('keeps different names apart', () => {
    expect(nameKey('Ali')).not.toBe(nameKey('Veli'));
  });
});

describe('isGameStatus', () => {
  it('accepts only the three statuses', () => {
    expect(isGameStatus('searching')).toBe(true);
    expect(isGameStatus('reserved')).toBe(true);
    expect(isGameStatus('cancelled')).toBe(true);
    expect(isGameStatus('full')).toBe(false);
    expect(isGameStatus(1)).toBe(false);
  });
});

describe('isJoinOpen', () => {
  const future = new Date('2026-11-14T18:00:00.000Z');
  it('is open for an upcoming, non-cancelled game', () => {
    expect(isJoinOpen('searching', future, NOW)).toBe(true);
    expect(isJoinOpen('reserved', future, NOW)).toBe(true);
  });
  it('is closed when cancelled or already started', () => {
    expect(isJoinOpen('cancelled', future, NOW)).toBe(false);
    expect(isJoinOpen('searching', NOW, NOW)).toBe(false);
    expect(isJoinOpen('searching', new Date('2026-10-01T18:00:00.000Z'), NOW)).toBe(false);
  });
});

describe('validateGameInput', () => {
  const opts = { now: NOW, requireFuture: true };

  it('accepts a valid game and normalises it', () => {
    const result = validateGameInput(rawGame({ venue: '  Sporthalle   Nord ' }), opts);
    expect(result).toEqual({
      ok: true,
      value: {
        venue: 'Sporthalle Nord',
        startsAt: new Date('2026-11-14T18:00:00.000Z'),
        capacity: 12,
        totalCostCents: 6000,
        organizerFree: true,
        organizerName: 'Deniz',
        organizerContact: 'WhatsApp 0151 000000',
        paymentNote: 'PayPal: deniz@example.com',
      },
    });
  });

  it('defaults organizerFree to false and an empty payment note to null', () => {
    const result = validateGameInput(rawGame({ organizerFree: undefined, paymentNote: '   ' }), opts);
    expect(result.ok && result.value.organizerFree).toBe(false);
    expect(result.ok && result.value.paymentNote).toBeNull();
  });

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['array', []],
  ])('rejects a body that is %s', (_label, body) => {
    expect(validateGameInput(body, opts).ok).toBe(false);
  });

  it.each([
    ['venue too short', { venue: 'a' }],
    ['venue too long', { venue: 'x'.repeat(121) }],
    ['missing date', { date: undefined }],
    ['impossible date', { date: '2026-02-30' }],
    ['bad time', { time: '25:00' }],
    ['past date', { date: '2026-10-01' }],
    ['capacity as string', { capacity: '12' }],
    ['capacity below minimum', { capacity: 3 }],
    ['capacity above maximum', { capacity: 61 }],
    ['fractional capacity', { capacity: 12.5 }],
    ['non-numeric cost', { totalCost: 'abc' }],
    ['negative cost', { totalCost: '-5' }],
    ['cost above limit', { totalCost: '10000,01' }],
    ['organizerFree as string', { organizerFree: 'yes' }],
    ['organizer name too short', { organizerName: ' a ' }],
    ['organizer name too long', { organizerName: 'x'.repeat(41) }],
    ['contact too short', { organizerContact: 'ab' }],
    ['payment note too long', { paymentNote: 'x'.repeat(301) }],
    ['payment note not a string', { paymentNote: 5 }],
  ])('rejects %s', (_label, over) => {
    const result = validateGameInput(rawGame(over), opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('allows a past date when requireFuture is false (editing)', () => {
    expect(validateGameInput(rawGame({ date: '2026-10-01' }), { now: NOW, requireFuture: false }).ok).toBe(true);
  });
});

describe('buildGameView', () => {
  it('splits the roster and computes cost for a partly filled game', () => {
    const view = buildGameView(row(), NOW);
    expect(view.startsAt).toBe('2026-11-14T18:00:00.000Z');
    expect(view.confirmed).toHaveLength(8);
    expect(view.waitlist).toHaveLength(0);
    expect(view.isFull).toBe(false);
    expect(view.joinOpen).toBe(true);
    expect(view.cost).toEqual({ payers: 7, perPersonCents: 857, perPersonWhenFullCents: 545 });
  });

  it('marks a full game and ignores the waitlist when pricing', () => {
    const view = buildGameView(row({ participants: people(15) }), NOW);
    expect(view.confirmed).toHaveLength(12);
    expect(view.waitlist.map((p) => p.id)).toEqual(['p12', 'p13', 'p14']);
    expect(view.isFull).toBe(true);
    expect(view.cost.payers).toBe(11);
    expect(view.cost.perPersonCents).toBe(545);
  });

  it('re-splits and re-prices when capacity is lower than the confirmed count', () => {
    const view = buildGameView(row({ capacity: 6, participants: people(8) }), NOW);
    expect(view.confirmed).toHaveLength(6);
    expect(view.waitlist.map((p) => p.id)).toEqual(['p6', 'p7']);
    expect(view.cost).toEqual({ payers: 5, perPersonCents: 1200, perPersonWhenFullCents: 1200 });
  });

  it('closes joining for cancelled and past games', () => {
    expect(buildGameView(row({ status: 'cancelled' }), NOW).joinOpen).toBe(false);
    expect(buildGameView(row({ startsAt: new Date('2026-10-01T18:00:00.000Z') }), NOW).joinOpen).toBe(false);
  });

  it('falls back to "searching" for an unknown stored status', () => {
    expect(buildGameView(row({ status: 'weird' }), NOW).status).toBe('searching');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/games.test.ts`
Expected: FAIL — cannot resolve `./games`.

- [ ] **Step 3: Write the implementation**

`src/lib/games.ts`:

```ts
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

/** Aynı oyunda aynı adın ikinci kez kullanılmasını engelleyen anahtar. */
export function nameKey(name: string): string {
  return name.toLocaleLowerCase('tr-TR');
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/games.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/games.ts src/lib/games.test.ts
git commit -m "feat(oyunlar): kadro, ucret ve dogrulama kurallari"
```

---

### Task 3: Tokens

**Files:**
- Create: `src/lib/gameTokens.ts`
- Test: `src/lib/gameTokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `generateToken(): string`
  - `hashToken(token: string): string` (64 hex chars)
  - `tokenMatches(token: unknown, hash: string | null | undefined): boolean`

This file uses `node:crypto` and must only be imported from server code (`gameService.ts`), never from a client component or `middleware.ts`.

- [ ] **Step 1: Write the failing test**

`src/lib/gameTokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, tokenMatches } from './gameTokens';

describe('game tokens', () => {
  it('generates distinct url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('hashes deterministically to 64 hex characters without revealing the token', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it('matches only the right token', () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(generateToken(), hash)).toBe(false);
    expect(tokenMatches(token + 'x', hash)).toBe(false);
  });

  it('never matches missing or malformed input', () => {
    const hash = hashToken(generateToken());
    expect(tokenMatches(null, hash)).toBe(false);
    expect(tokenMatches(undefined, hash)).toBe(false);
    expect(tokenMatches('', hash)).toBe(false);
    expect(tokenMatches(42, hash)).toBe(false);
    expect(tokenMatches('abc', null)).toBe(false);
    expect(tokenMatches('abc', undefined)).toBe(false);
    expect(tokenMatches('abc', 'not-a-hash')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/gameTokens.test.ts`
Expected: FAIL — cannot resolve `./gameTokens`.

- [ ] **Step 3: Write the implementation**

`src/lib/gameTokens.ts`:

```ts
// Node-only (node:crypto). Sadece sunucu kodundan içe aktarın.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Yönetim ve ayrılma anahtarları. Veritabanında yalnızca hash'i tutulur. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: unknown, hash: string | null | undefined): boolean {
  if (typeof token !== 'string' || token === '' || !hash) return false;
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/gameTokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameTokens.ts src/lib/gameTokens.test.ts
git commit -m "feat(oyunlar): yonetim ve ayrilma anahtarlari"
```

---

### Task 4: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (append two models at the end)
- Create: `prisma/migrations/20261011120000_add_games/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma client delegates `prisma.game` and `prisma.gameParticipant` with the fields below. `GameParticipant` has a unique constraint on `(gameId, nameKey)`; a violation surfaces as `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'`.

- [ ] **Step 1: Append the models to `prisma/schema.prisma`**

```prisma
/// Herkese açık "Oyun Bul / Oyun Oluştur". Week/Player yapısından bağımsızdır.
model Game {
  id               String            @id @default(cuid())
  venue            String
  startsAt         DateTime
  capacity         Int
  totalCostCents   Int
  organizerFree    Boolean           @default(false)
  organizerName    String
  organizerContact String
  paymentNote      String?
  /// "searching" | "reserved" | "cancelled"
  status           String            @default("searching")
  manageTokenHash  String
  createdAt        DateTime          @default(now())
  participants     GameParticipant[]

  @@index([startsAt])
}

/// Katılma sırası (createdAt, id). İlk `capacity` kişi kesin, kalanı yedek.
model GameParticipant {
  id             String   @id @default(cuid())
  gameId         String
  name           String
  /// Küçük harfe çevrilmiş ad; aynı oyunda aynı adı engeller.
  nameKey        String
  isOrganizer    Boolean  @default(false)
  /// Organizatör satırında null (organizatör ayrılamaz).
  leaveTokenHash String?
  createdAt      DateTime @default(now())
  game           Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@unique([gameId, nameKey])
  @@index([gameId, createdAt])
}
```

- [ ] **Step 2: Write the migration by hand**

Do not run `prisma migrate dev` (it may reset or prompt against the real database). Create `prisma/migrations/20261011120000_add_games/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL,
    "organizerFree" BOOLEAN NOT NULL DEFAULT false,
    "organizerName" TEXT NOT NULL,
    "organizerContact" TEXT NOT NULL,
    "paymentNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'searching',
    "manageTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "isOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "leaveTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Game_startsAt_idx" ON "Game"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_nameKey_key" ON "GameParticipant"("gameId", "nameKey");

-- CreateIndex
CREATE INDEX "GameParticipant_gameId_createdAt_idx" ON "GameParticipant"("gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate the schema and regenerate the client (no database access)**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Confirm the hand-written SQL matches the schema**

Run: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$TEST_DATABASE_URL" --exit-code`
Expected: `No difference detected.` and exit code 0.

This needs `TEST_DATABASE_URL` (a throwaway database, see `.env.example`). If it is not set, skip this step, say so in the task report, and rely on Step 6's `migrate status`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261011120000_add_games/migration.sql
git commit -m "feat(oyunlar): Game ve GameParticipant tablolari"
```

- [ ] **Step 6: STOP — ask the user before touching the database**

`DATABASE_URL` in `.env` may be production. Tell the user:

> "Sıradaki adım `npx prisma migrate deploy` — `.env` içindeki veritabanına iki yeni tablo ekler, mevcut tablolara dokunmaz. Bu veritabanı canlı olabilir. Çalıştırayım mı?"

Only after an explicit yes:

Run: `npx prisma migrate deploy`
Expected: `Applying migration '20261011120000_add_games'` then `All migrations have been successfully applied.`

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

If the user declines, continue with Tasks 5–9 (they compile and unit-test without the tables) and mark Task 10's manual run as blocked.

---

### Task 5: Game service

**Files:**
- Create: `src/lib/gameService.ts`
- Create: `src/lib/gameHttp.ts`

**Interfaces:**
- Consumes: `prisma` from `src/lib/db.ts`; `generateToken`, `hashToken`, `tokenMatches` from Task 3; `buildGameView`, `cleanText`, `isJoinOpen`, `nameKey`, `type GameInput`, `type GameStatus`, `type GameView` from Task 2; Prisma models from Task 4.
- Produces (`src/lib/gameService.ts`):
  - `class GameError extends Error { status: number }`
  - `createGame(input: GameInput): Promise<{ id: string; manageToken: string }>`
  - `getGameView(id: string, now?: Date): Promise<GameView | null>`
  - `listUpcomingGames(now?: Date): Promise<GameView[]>` — `startsAt >= now`, not cancelled, soonest first
  - `listAllGames(now?: Date): Promise<GameView[]>` — newest `startsAt` first
  - `isManageTokenValid(id: string, token: unknown): Promise<boolean>`
  - `updateGame(id: string, manageToken: unknown, changes: { input?: GameInput; status?: GameStatus }): Promise<void>` — throws `GameError` 404 / 403 / 409
  - `type JoinResult = { participantId: string; leaveToken: string; placement: 'confirmed' | 'waitlisted'; waitlistPosition: number | null }`
  - `joinGame(id: string, rawName: unknown, now?: Date): Promise<JoinResult>` — throws `GameError` 400 / 404 / 409
  - `removeParticipant(gameId: string, participantId: string, tokens: { leaveToken?: unknown; manageToken?: unknown }): Promise<void>` — throws `GameError` 400 / 403 / 404
  - `deleteGame(id: string): Promise<boolean>`
- Produces (`src/lib/gameHttp.ts`):
  - `gameErrorResponse(err: unknown): NextResponse` — maps `GameError` to `{ error }` + status, rethrows anything else

There is no unit test for this file: it is a thin Prisma layer and `npm test` must not touch a database. Its rules live in Task 2's pure functions; the flow is exercised end to end in Task 10.

- [ ] **Step 1: Write `src/lib/gameService.ts`**

```ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateToken, hashToken, tokenMatches } from '@/lib/gameTokens';
import {
  buildGameView,
  cleanText,
  isJoinOpen,
  nameKey,
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
    select: { id: true, name: true, isOrganizer: true },
  },
} satisfies Prisma.GameInclude;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function gameData(input: GameInput) {
  return {
    venue: input.venue,
    startsAt: input.startsAt,
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
        create: { name: input.organizerName, nameKey: nameKey(input.organizerName), isOrganizer: true },
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
          data: { name: input.organizerName, nameKey: nameKey(input.organizerName) },
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

export async function joinGame(id: string, rawName: unknown, now: Date = new Date()): Promise<JoinResult> {
  const name = cleanText(rawName, 2, 40);
  if (!name) throw new GameError('Ad 2–40 karakter olmalı', 400);

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
      data: { gameId: id, name, nameKey: nameKey(name), leaveTokenHash: hashToken(leaveToken) },
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
```

- [ ] **Step 2: Write `src/lib/gameHttp.ts`**

```ts
import { NextResponse } from 'next/server';
import { GameError } from '@/lib/gameService';

/** GameError'ı `{ error }` yanıtına çevirir; beklenmeyen hatayı yeniden fırlatır. */
export function gameErrorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the whole unit suite**

Run: `npm test`
Expected: PASS (existing tests plus Tasks 1–3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameService.ts src/lib/gameHttp.ts
git commit -m "feat(oyunlar): oyun servisi"
```

---

### Task 6: API routes

**Files:**
- Create: `src/app/api/games/route.ts`
- Create: `src/app/api/games/[id]/route.ts`
- Create: `src/app/api/games/[id]/participants/route.ts`
- Create: `src/app/api/games/[id]/participants/[pid]/route.ts`
- Create: `src/app/api/admin/games/[id]/route.ts`

**Interfaces:**
- Consumes: everything Task 5 produces; `validateGameInput`, `isGameStatus`, `type GameInput`, `type GameStatus` from Task 2.
- Produces (HTTP):
  - `POST /api/games` — body: raw game fields → `201 { id, manageToken }` | `400 { error }`
  - `PATCH /api/games/[id]` — header `x-manage-token`; body `{ game?: <raw game fields>, status?: GameStatus }` → `200 { game: GameView }` | `400` | `403` | `404` | `409`
  - `POST /api/games/[id]/participants` — body `{ name }` → `201 { participantId, leaveToken, placement, waitlistPosition }` | `400` | `404` | `409`
  - `DELETE /api/games/[id]/participants/[pid]` — header `x-leave-token` or `x-manage-token` → `200 { success: true }` | `400` | `403` | `404`
  - `DELETE /api/admin/games/[id]` — admin session (enforced by `src/middleware.ts`, matcher `/api/admin/:path*`) → `200 { success: true }` | `404`

- [ ] **Step 1: `src/app/api/games/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { validateGameInput } from '@/lib/games';
import { createGame } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = validateGameInput(body, { now: new Date(), requireFuture: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const created = await createGame(parsed.value);
  return NextResponse.json(created, { status: 201 });
}
```

- [ ] **Step 2: `src/app/api/games/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isGameStatus, validateGameInput, type GameInput, type GameStatus } from '@/lib/games';
import { getGameView, updateGame } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  const { game, status } = body as { game?: unknown; status?: unknown };
  const changes: { input?: GameInput; status?: GameStatus } = {};

  if (game !== undefined) {
    // Düzenlemede tarih geçmişte kalmış olabilir; yalnızca oluştururken gelecek şartı aranır.
    const parsed = validateGameInput(game, { now: new Date(), requireFuture: false });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    changes.input = parsed.value;
  }
  if (status !== undefined) {
    if (!isGameStatus(status)) {
      return NextResponse.json({ error: 'Geçersiz durum değeri' }, { status: 400 });
    }
    changes.status = status;
  }
  if (!changes.input && !changes.status) {
    return NextResponse.json({ error: 'Değişiklik gönderilmedi' }, { status: 400 });
  }

  try {
    await updateGame(params.id, request.headers.get('x-manage-token'), changes);
  } catch (err) {
    return gameErrorResponse(err);
  }
  return NextResponse.json({ game: await getGameView(params.id) });
}
```

- [ ] **Step 3: `src/app/api/games/[id]/participants/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { joinGame } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  const name = typeof body === 'object' && body !== null ? (body as { name?: unknown }).name : undefined;
  try {
    const result = await joinGame(params.id, name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
```

- [ ] **Step 4: `src/app/api/games/[id]/participants/[pid]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { removeParticipant } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  try {
    await removeParticipant(params.id, params.pid, {
      leaveToken: request.headers.get('x-leave-token'),
      manageToken: request.headers.get('x-manage-token'),
    });
  } catch (err) {
    return gameErrorResponse(err);
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: `src/app/api/admin/games/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { deleteGame } from '@/lib/gameService';

// Yetki kontrolü src/middleware.ts içinde (/api/admin/:path*).
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const deleted = await deleteGame(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Oyun bulunamadı' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: `No ESLint warnings or errors` (or only warnings that already exist on `master`).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/games src/app/api/admin/games
git commit -m "feat(oyunlar): API rotalari"
```

---

### Task 7: Public pages — list, create, detail

**Files:**
- Create: `src/lib/gameStorage.ts`
- Create: `src/components/GameCard.tsx`
- Create: `src/components/CopyLinkButton.tsx`
- Create: `src/components/GameForm.tsx`
- Create: `src/components/GameJoinPanel.tsx`
- Create: `src/components/GameOwnerBox.tsx`
- Create: `src/app/oyunlar/page.tsx`
- Create: `src/app/oyunlar/yeni/page.tsx`
- Create: `src/app/oyunlar/[id]/page.tsx`
- Modify: `src/components/PublicNav.tsx:7-12` (the `LINKS` array)

**Interfaces:**
- Consumes: `GameView`, `GameStatus`, `GAME_STATUS_LABELS`, `formatEuro`, `euroAmount` (Task 2); `formatGameDate`, `berlinParts` (Task 1); `getGameView`, `listUpcomingGames` (Task 5); HTTP API (Task 6); existing `PublicNav`; `CAPACITY_MIN`, `CAPACITY_MAX` from `src/lib/capacity.ts`.
- Produces:
  - `src/lib/gameStorage.ts`: `interface LeaveRecord { participantId: string; token: string }`, `readManageToken(gameId: string): string | null`, `saveManageToken(gameId: string, token: string): void`, `readLeave(gameId: string): LeaveRecord | null`, `saveLeave(gameId: string, record: LeaveRecord): void`, `clearLeave(gameId: string): void`
  - `GameStatusBadge({ status }: { status: GameStatus })`, `gamePriceLabel(game: GameView): string`, `GameCard({ game }: { game: GameView })`
  - `CopyLinkButton({ path, label }: { path: string; label: string })`
  - `interface GameFormValues { venue: string; date: string; time: string; capacity: string; totalCost: string; organizerFree: boolean; organizerName: string; organizerContact: string; paymentNote: string }`
  - `GameForm({ gameId?, manageToken?, initial? }: { gameId?: string; manageToken?: string; initial?: GameFormValues })` — creates when `gameId` is absent, edits otherwise
  - `GameJoinPanel({ gameId, joinOpen, isFull, participantIds }: { gameId: string; joinOpen: boolean; isFull: boolean; participantIds: string[] })`
  - `GameOwnerBox({ gameId }: { gameId: string })`

- [ ] **Step 1: `src/lib/gameStorage.ts`**

```ts
// Tarayıcıda çalışır. localStorage kapalı olabilir (gizli pencere, engellenmiş
// site verisi); bu durumda sessizce boş döner — katılma yine çalışır, yalnızca
// sayfa yenilenince "Ayrıl" düğmesi kaybolur.

export interface LeaveRecord {
  participantId: string;
  token: string;
}

const manageKey = (gameId: string) => `oyun:${gameId}:manage`;
const leaveKey = (gameId: string) => `oyun:${gameId}:leave`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // yoksay
  }
}

export function readManageToken(gameId: string): string | null {
  return read(manageKey(gameId));
}

export function saveManageToken(gameId: string, token: string): void {
  write(manageKey(gameId), token);
}

export function readLeave(gameId: string): LeaveRecord | null {
  const raw = read(leaveKey(gameId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LeaveRecord>;
    return typeof parsed.participantId === 'string' && typeof parsed.token === 'string'
      ? { participantId: parsed.participantId, token: parsed.token }
      : null;
  } catch {
    return null;
  }
}

export function saveLeave(gameId: string, record: LeaveRecord): void {
  write(leaveKey(gameId), JSON.stringify(record));
}

export function clearLeave(gameId: string): void {
  write(leaveKey(gameId), null);
}
```

- [ ] **Step 2: `src/components/GameCard.tsx`**

```tsx
import Link from 'next/link';
import { formatGameDate } from '@/lib/berlinTime';
import { GAME_STATUS_LABELS, formatEuro, type GameStatus, type GameView } from '@/lib/games';

const STATUS_STYLES: Record<GameStatus, string> = {
  searching: 'bg-amber-100 text-amber-800',
  reserved: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export function GameStatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[status]}`}>
      {GAME_STATUS_LABELS[status]}
    </span>
  );
}

export function FullBadge() {
  return <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-blue-100 text-blue-800">Dolu</span>;
}

export function gamePriceLabel(game: GameView): string {
  if (game.totalCostCents === 0) return 'Ücretsiz';
  return game.cost.perPersonCents === null
    ? `Toplam ${formatEuro(game.totalCostCents)}`
    : `Kişi başı ${formatEuro(game.cost.perPersonCents)}`;
}

export function GameCard({ game }: { game: GameView }) {
  return (
    <Link
      href={`/oyunlar/${game.id}`}
      className="block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-400"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h2 className="font-semibold break-words">{game.venue}</h2>
        <GameStatusBadge status={game.status} />
        {game.isFull && <FullBadge />}
      </div>
      <p className="text-sm text-slate-700">{formatGameDate(game.startsAt)}</p>
      <p className="text-sm text-slate-600 mt-1">
        {game.confirmed.length}/{game.capacity} oyuncu
        {game.waitlist.length > 0 && ` · ${game.waitlist.length} yedek`} · {gamePriceLabel(game)}
      </p>
      <p className="text-xs text-slate-500 mt-1 break-words">Organizatör: {game.organizerName}</p>
    </Link>
  );
}
```

- [ ] **Step 3: `src/components/CopyLinkButton.tsx`**

```tsx
'use client';

import { useState } from 'react';

/** `path` site içi bir yoldur ("/oyunlar/abc"); tam adres tarayıcıda oluşturulur. */
export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function handleCopy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano erişimi yoksa (http, eski tarayıcı) adresi elle kopyalanacak şekilde göster.
      setFallbackUrl(url);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        {copied ? 'Kopyalandı ✓' : label}
      </button>
      {fallbackUrl && (
        <input
          readOnly
          value={fallbackUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Bağlantı"
          className="border rounded px-2 py-1 text-sm w-full"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: `src/components/GameForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAPACITY_MAX, CAPACITY_MIN } from '@/lib/capacity';
import { saveManageToken } from '@/lib/gameStorage';

export interface GameFormValues {
  venue: string;
  date: string;
  time: string;
  capacity: string;
  totalCost: string;
  organizerFree: boolean;
  organizerName: string;
  organizerContact: string;
  paymentNote: string;
}

const EMPTY: GameFormValues = {
  venue: '',
  date: '',
  time: '19:00',
  capacity: '12',
  totalCost: '',
  organizerFree: false,
  organizerName: '',
  organizerContact: '',
  paymentNote: '',
};

interface GameFormProps {
  /** Verilirse düzenleme, verilmezse oluşturma. */
  gameId?: string;
  manageToken?: string;
  initial?: GameFormValues;
}

const INPUT = 'border rounded px-2 py-1.5 w-full';

export function GameForm({ gameId, manageToken, initial }: GameFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<GameFormValues>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isEdit = gameId !== undefined;

  function set<K extends keyof GameFormValues>(key: K, value: GameFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const game = { ...values, capacity: Number(values.capacity) };
    try {
      const res = isEdit
        ? await fetch(`/api/games/${gameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-manage-token': manageToken ?? '' },
            body: JSON.stringify({ game }),
          })
        : await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (isEdit ? 'Oyun güncellenemedi' : 'Oyun oluşturulamadı'));
        return;
      }
      if (isEdit) {
        setSaved(true);
        router.refresh();
      } else {
        saveManageToken(data.id, data.manageToken);
        router.push(`/oyunlar/${data.id}`);
      }
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div>
        <label htmlFor="game-venue" className="block text-sm mb-1">Saha</label>
        <input
          id="game-venue"
          value={values.venue}
          onChange={(e) => set('venue', e.target.value)}
          placeholder="Salon adı ve adresi"
          maxLength={120}
          required
          className={INPUT}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="game-date" className="block text-sm mb-1">Tarih</label>
          <input
            id="game-date"
            type="date"
            value={values.date}
            onChange={(e) => set('date', e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="game-time" className="block text-sm mb-1">Saat</label>
          <input
            id="game-time"
            type="time"
            value={values.time}
            onChange={(e) => set('time', e.target.value)}
            required
            className={INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Saat Almanya saatine göredir.</p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="game-capacity" className="block text-sm mb-1">Oyuncu sayısı</label>
          <input
            id="game-capacity"
            type="number"
            min={CAPACITY_MIN}
            max={CAPACITY_MAX}
            step={1}
            value={values.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="game-cost" className="block text-sm mb-1">Toplam saha bedeli (€)</label>
          <input
            id="game-cost"
            inputMode="decimal"
            value={values.totalCost}
            onChange={(e) => set('totalCost', e.target.value)}
            placeholder="60"
            required
            className={INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Kişi başı ücret, katılan oyuncu sayısına göre otomatik hesaplanır. Ücretsizse 0 yazın.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.organizerFree}
          onChange={(e) => set('organizerFree', e.target.checked)}
          className="mt-1"
        />
        <span>Organizatör ücret ödemez (saha bedeli diğer oyuncular arasında bölünür)</span>
      </label>

      <div>
        <label htmlFor="game-organizer" className="block text-sm mb-1">Adınız</label>
        <input
          id="game-organizer"
          value={values.organizerName}
          onChange={(e) => set('organizerName', e.target.value)}
          maxLength={40}
          required
          className={INPUT}
        />
        <p className="text-xs text-slate-500 mt-1">Organizatör olarak ilk oyuncu siz olursunuz.</p>
      </div>

      <div>
        <label htmlFor="game-contact" className="block text-sm mb-1">İletişim</label>
        <input
          id="game-contact"
          value={values.organizerContact}
          onChange={(e) => set('organizerContact', e.target.value)}
          placeholder="Telefon, WhatsApp, e-posta…"
          maxLength={120}
          required
          className={INPUT}
        />
        <p className="text-xs text-slate-500 mt-1">Bu bilgi oyunu gören herkese açıktır.</p>
      </div>

      <div>
        <label htmlFor="game-payment" className="block text-sm mb-1">Ödeme notu (isteğe bağlı)</label>
        <textarea
          id="game-payment"
          value={values.paymentNote}
          onChange={(e) => set('paymentNote', e.target.value)}
          placeholder="PayPal adresi veya IBAN"
          maxLength={300}
          rows={2}
          className={INPUT}
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Kaydedildi.</p>}

      <button
        type="submit"
        disabled={busy}
        className="self-start bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {busy ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri Kaydet' : 'Oyunu Oluştur'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: `src/components/GameJoinPanel.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearLeave, readLeave, saveLeave, type LeaveRecord } from '@/lib/gameStorage';

interface GameJoinPanelProps {
  gameId: string;
  joinOpen: boolean;
  isFull: boolean;
  /** Kesin + yedek tüm katılımcıların id'leri */
  participantIds: string[];
}

export function GameJoinPanel({ gameId, joinOpen, isFull, participantIds }: GameJoinPanelProps) {
  const router = useRouter();
  const [mine, setMine] = useState<LeaveRecord | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bu tarayıcıdan katılınmış mı? Organizatör kişiyi çıkardıysa kayıt eskimiştir.
  useEffect(() => {
    const record = readLeave(gameId);
    if (record && !participantIds.includes(record.participantId)) {
      clearLeave(gameId);
      setMine(null);
    } else if (record) {
      setMine(record);
    }
  }, [gameId, participantIds]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/games/${gameId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Katılım başarısız');
        if (res.status === 409) router.refresh();
        return;
      }
      const record = { participantId: data.participantId, token: data.leaveToken };
      saveLeave(gameId, record);
      setMine(record);
      setName('');
      setNotice(
        data.placement === 'waitlisted'
          ? `Kontenjan dolu, yedek listesindesiniz (${data.waitlistPosition}. sıra).`
          : 'Katıldınız!'
      );
      router.refresh();
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (busy || !mine) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/games/${gameId}/participants/${mine.participantId}`, {
        method: 'DELETE',
        headers: { 'x-leave-token': mine.token },
      });
      // 404: organizatör zaten çıkarmış — sonuç aynı.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Ayrılma başarısız');
        return;
      }
      clearLeave(gameId);
      setMine(null);
      setNotice('Oyundan ayrıldınız.');
      router.refresh();
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      {mine ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Bu oyuna katıldınız.</p>
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Ayrılınıyor…' : 'Ayrıl'}
          </button>
        </div>
      ) : joinOpen ? (
        <form onSubmit={handleJoin} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="join-name" className="block text-sm mb-1">Adınız</label>
            <input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              className="border rounded px-2 py-1.5 w-full"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : isFull ? 'Yedek listesine katıl' : 'Katıl'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">Bu oyuna artık katılınamıyor.</p>
      )}
      {notice && <p className="text-sm text-green-700 mt-2">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      {mine && (
        <p className="text-xs text-slate-500 mt-2">
          Yalnızca bu cihazdan ayrılabilirsiniz. Başka cihazdaysanız organizatöre yazın.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `src/components/GameOwnerBox.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readManageToken } from '@/lib/gameStorage';
import { CopyLinkButton } from '@/components/CopyLinkButton';

/** Oyunu bu tarayıcıdan açan kişiye yönetim bağlantısını gösterir. */
export function GameOwnerBox({ gameId }: { gameId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(readManageToken(gameId));
  }, [gameId]);

  if (!token) return null;
  const managePath = `/oyunlar/${gameId}/yonet?k=${encodeURIComponent(token)}`;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <h2 className="font-semibold mb-1">Bu oyunu siz açtınız</h2>
      <p className="text-sm text-slate-700 mb-3">
        Yönetim bağlantısını saklayın: oyunu düzenlemenin tek yolu budur ve kaybolursa geri alınamaz. Bu
        bağlantıyı başkalarıyla paylaşmayın.
      </p>
      <div className="flex flex-wrap items-start gap-2">
        <Link href={managePath} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm">
          Oyunu yönet
        </Link>
        <CopyLinkButton path={managePath} label="Yönetim bağlantısını kopyala" />
      </div>
    </section>
  );
}
```

- [ ] **Step 7: `src/app/oyunlar/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { GameCard } from '@/components/GameCard';
import { listUpcomingGames } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Oyun Bul' };

export default async function GamesPage() {
  const games = await listUpcomingGames();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">Oyun Bul</h1>
        <Link href="/oyunlar/yeni" className="bg-blue-700 text-white rounded-lg px-4 py-2">
          Oyun Oluştur
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="text-slate-600">
          Şu an yaklaşan bir oyun yok. İlk oyunu siz açın ve bağlantısını paylaşın.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 8: `src/app/oyunlar/yeni/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { GameForm } from '@/components/GameForm';

export const metadata: Metadata = { title: 'Oyun Oluştur' };

export default function NewGamePage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href="/oyunlar" className="text-sm underline">← Tüm oyunlar</Link>
      <h1 className="text-xl font-bold mt-2 mb-4">Oyun Oluştur</h1>
      <GameForm />
    </main>
  );
}
```

- [ ] **Step 9: `src/app/oyunlar/[id]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { FullBadge, GameStatusBadge } from '@/components/GameCard';
import { GameJoinPanel } from '@/components/GameJoinPanel';
import { GameOwnerBox } from '@/components/GameOwnerBox';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { formatGameDate } from '@/lib/berlinTime';
import { formatEuro, type GameView } from '@/lib/games';
import { getGameView } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export default async function GamePage({ params }: { params: { id: string } }) {
  const game = await getGameView(params.id);
  if (!game) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href="/oyunlar" className="text-sm underline">← Tüm oyunlar</Link>

      <header className="mt-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold break-words">{game.venue}</h1>
          <GameStatusBadge status={game.status} />
          {game.isFull && <FullBadge />}
        </div>
        <p className="text-slate-700">{formatGameDate(game.startsAt)}</p>
      </header>

      <div className="flex flex-col gap-4">
        <GameOwnerBox gameId={game.id} />
        <CostSection game={game} />

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Organizatör</h2>
          <p className="text-sm break-words">{game.organizerName}</p>
          <p className="text-sm text-slate-700 break-words">{game.organizerContact}</p>
        </section>

        <GameJoinPanel
          gameId={game.id}
          joinOpen={game.joinOpen}
          isFull={game.isFull}
          participantIds={[...game.confirmed, ...game.waitlist].map((p) => p.id)}
        />

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">
            Oyuncular ({game.confirmed.length}/{game.capacity})
          </h2>
          <ol className="list-decimal list-inside text-sm space-y-1">
            {game.confirmed.map((p) => (
              <li key={p.id} className="break-words">
                {p.name}
                {p.isOrganizer && <span className="text-xs text-slate-500"> · organizatör</span>}
              </li>
            ))}
          </ol>
          {game.waitlist.length > 0 && (
            <>
              <h3 className="font-semibold mt-4 mb-2">Yedekler ({game.waitlist.length})</h3>
              <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700">
                {game.waitlist.map((p) => (
                  <li key={p.id} className="break-words">{p.name}</li>
                ))}
              </ol>
              <p className="text-xs text-slate-500 mt-2">
                Biri ayrılınca listenin başındaki yedek kendiliğinden oyuncu olur.
              </p>
            </>
          )}
        </section>

        <CopyLinkButton path={`/oyunlar/${game.id}`} label="Oyun bağlantısını kopyala" />
      </div>
    </main>
  );
}

function CostSection({ game }: { game: GameView }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <h2 className="font-semibold mb-2">Ücret</h2>
      {game.totalCostCents === 0 ? (
        <p className="text-sm">Ücretsiz</p>
      ) : (
        <>
          <ul className="text-sm space-y-1">
            <li className="flex justify-between gap-4">
              <span>Toplam saha bedeli</span>
              <span className="font-medium">{formatEuro(game.totalCostCents)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Şu an kişi başı ({game.cost.payers} kişi ödüyor)</span>
              <span className="font-medium">
                {game.cost.perPersonCents === null ? '—' : formatEuro(game.cost.perPersonCents)}
              </span>
            </li>
            {game.cost.perPersonWhenFullCents !== null && (
              <li className="flex justify-between gap-4">
                <span>Oyun dolarsa kişi başı</span>
                <span className="font-medium">{formatEuro(game.cost.perPersonWhenFullCents)}</span>
              </li>
            )}
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            {game.organizerFree
              ? 'Organizatör ücret ödemez; saha bedeli diğer oyuncular arasında bölünür. '
              : 'Saha bedeli organizatör dahil tüm oyuncular arasında bölünür. '}
            Yedekler ödemez. Kişi başı ücret, katılan oyuncu sayısı değiştikçe değişir.
          </p>
        </>
      )}
      {game.paymentNote && (
        <p className="text-sm mt-3 break-words">
          <span className="font-medium">Ödeme: </span>
          {game.paymentNote}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 10: Add the nav link**

In `src/components/PublicNav.tsx`, change the `LINKS` array to:

```tsx
const LINKS = [
  { href: '/', label: 'Ana Sayfa' },
  { href: '/oyunlar', label: 'Oyun Bul' },
  { href: '/players', label: 'Oyuncular' },
  { href: '/statistics', label: 'İstatistikler' },
  { href: '/arsiv', label: 'Geçmiş Haftalar' },
];
```

- [ ] **Step 11: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings or errors.

- [ ] **Step 12: Commit**

```bash
git add src/lib/gameStorage.ts src/components/GameCard.tsx src/components/CopyLinkButton.tsx src/components/GameForm.tsx src/components/GameJoinPanel.tsx src/components/GameOwnerBox.tsx src/app/oyunlar src/components/PublicNav.tsx
git commit -m "feat(oyunlar): oyun listesi, olusturma ve detay sayfalari"
```

---

### Task 8: Organizer manage page

**Files:**
- Create: `src/components/GameManagePanel.tsx`
- Create: `src/app/oyunlar/[id]/yonet/page.tsx`

**Interfaces:**
- Consumes: `GameForm`, `type GameFormValues` (Task 7); `saveManageToken` (Task 7); `ConfirmDialog` from `src/components/ConfirmDialog.tsx` (props: `open`, `title`, `warning?`, `confirmLabel?`, `danger?`, `disabled?`, `onConfirm`, `onCancel`); `GameStatusBadge` (Task 7); `getGameView`, `isManageTokenValid` (Task 5); `berlinParts` (Task 1); `euroAmount`, `GAME_STATUS_LABELS`, `type GameStatus`, `type GameView` (Task 2); HTTP API (Task 6).
- Produces:
  - `GameManagePanel({ game, manageToken, initial }: { game: GameView; manageToken: string; initial: GameFormValues })`
  - Page `/oyunlar/[id]/yonet?k=<manageToken>` — 404 when the token is missing or wrong.

- [ ] **Step 1: `src/components/GameManagePanel.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GameForm, type GameFormValues } from '@/components/GameForm';
import { GameStatusBadge } from '@/components/GameCard';
import { saveManageToken } from '@/lib/gameStorage';
import { GAME_STATUS_LABELS, type GameParticipantView, type GameStatus, type GameView } from '@/lib/games';

interface GameManagePanelProps {
  game: GameView;
  manageToken: string;
  initial: GameFormValues;
}

export function GameManagePanel({ game, manageToken, initial }: GameManagePanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toRemove, setToRemove] = useState<GameParticipantView | null>(null);

  // Yönetim bağlantısı başka cihazda açıldıysa o cihaz da oyunu yönetebilsin.
  useEffect(() => {
    saveManageToken(game.id, manageToken);
  }, [game.id, manageToken]);

  async function send(url: string, init: RequestInit, fallbackError: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-manage-token': manageToken },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? fallbackError);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: GameStatus) {
    await send(
      `/api/games/${game.id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      'Durum güncellenemedi'
    );
    setConfirmCancel(false);
  }

  async function removeParticipant() {
    if (!toRemove) return;
    await send(`/api/games/${game.id}/participants/${toRemove.id}`, { method: 'DELETE' }, 'Oyuncu çıkarılamadı');
    setToRemove(null);
  }

  const everyone = [...game.confirmed, ...game.waitlist];

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-semibold">Durum</h2>
          <GameStatusBadge status={game.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['searching', 'reserved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(status)}
              disabled={busy || game.status === status}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {GAME_STATUS_LABELS[status]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={busy || game.status === 'cancelled'}
            className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Oyunu iptal et
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-2">
          Katılımcılar ({game.confirmed.length}/{game.capacity}
          {game.waitlist.length > 0 && ` + ${game.waitlist.length} yedek`})
        </h2>
        <ul className="text-sm divide-y divide-slate-100">
          {everyone.map((p, index) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="break-words">
                {p.name}
                <span className="text-xs text-slate-500">
                  {p.isOrganizer ? ' · organizatör' : index >= game.capacity ? ' · yedek' : ''}
                </span>
              </span>
              {!p.isOrganizer && (
                <button
                  type="button"
                  onClick={() => setToRemove(p)}
                  disabled={busy}
                  className="text-red-600 underline disabled:opacity-50"
                >
                  Çıkar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Oyun bilgileri</h2>
        <GameForm gameId={game.id} manageToken={manageToken} initial={initial} />
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Oyunu iptal et"
        warning="İptal edilen oyun listeden kalkar ve kimse katılamaz. Bağlantısı açılmaya devam eder."
        confirmLabel={busy ? 'İptal ediliyor…' : 'Oyunu İptal Et'}
        danger
        disabled={busy}
        onConfirm={() => setStatus('cancelled')}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={toRemove !== null}
        title="Oyuncuyu çıkar"
        details={toRemove ? [{ label: 'Oyuncu', value: toRemove.name }] : undefined}
        warning="Çıkarılan oyuncunun yerine sıradaki yedek geçer."
        confirmLabel={busy ? 'Çıkarılıyor…' : 'Çıkar'}
        danger
        disabled={busy}
        onConfirm={removeParticipant}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: `src/app/oyunlar/[id]/yonet/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { GameManagePanel } from '@/components/GameManagePanel';
import { berlinParts } from '@/lib/berlinTime';
import { euroAmount } from '@/lib/games';
import { getGameView, isManageTokenValid } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

// Adres gizli anahtar taşır: arama motorlarına ve başka sitelere sızmasın.
export const metadata: Metadata = {
  title: 'Oyunu Yönet',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ManageGamePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { k?: string | string[] };
}) {
  const token = typeof searchParams.k === 'string' ? searchParams.k : '';
  if (!(await isManageTokenValid(params.id, token))) notFound();

  const game = await getGameView(params.id);
  if (!game) notFound();

  const { date, time } = berlinParts(new Date(game.startsAt));

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href={`/oyunlar/${game.id}`} className="text-sm underline">← Oyun sayfası</Link>
      <h1 className="text-xl font-bold mt-2 mb-4 break-words">Oyunu Yönet: {game.venue}</h1>
      <GameManagePanel
        game={game}
        manageToken={token}
        initial={{
          venue: game.venue,
          date,
          time,
          capacity: String(game.capacity),
          totalCost: euroAmount(game.totalCostCents),
          organizerFree: game.organizerFree,
          organizerName: game.organizerName,
          organizerContact: game.organizerContact,
          paymentNote: game.paymentNote ?? '',
        }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings or errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/GameManagePanel.tsx src/app/oyunlar/[id]/yonet
git commit -m "feat(oyunlar): organizator yonetim sayfasi"
```

---

### Task 9: Admin list and delete

**Files:**
- Create: `src/components/AdminGameDeleteButton.tsx`
- Create: `src/app/admin/oyunlar/page.tsx`
- Modify: `src/app/admin/layout.tsx:9` (add a nav link after "Haftalar")

**Interfaces:**
- Consumes: `listAllGames` (Task 5); `DELETE /api/admin/games/[id]` (Task 6); `ConfirmDialog`; `GameStatusBadge` (Task 7); `formatGameDate` (Task 1). `/admin/*` pages are already protected by `src/middleware.ts`.
- Produces: `AdminGameDeleteButton({ gameId, venue, date }: { gameId: string; venue: string; date: string })`; page `/admin/oyunlar`.

- [ ] **Step 1: `src/components/AdminGameDeleteButton.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function AdminGameDeleteButton({ gameId, venue, date }: { gameId: string; venue: string; date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Silme başarısız');
        return;
      }
      router.refresh();
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-red-600 underline">
        Sil
      </button>
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      <ConfirmDialog
        open={open}
        title="Oyunu kalıcı olarak sil"
        details={[
          { label: 'Saha', value: venue },
          { label: 'Tarih', value: date },
        ]}
        warning="Oyun ve tüm katılımcıları silinir. Bu işlem geri alınamaz."
        confirmLabel={busy ? 'Siliniyor…' : 'Kalıcı Olarak Sil'}
        danger
        disabled={busy}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: `src/app/admin/oyunlar/page.tsx`**

```tsx
import Link from 'next/link';
import { AdminGameDeleteButton } from '@/components/AdminGameDeleteButton';
import { GameStatusBadge } from '@/components/GameCard';
import { formatGameDate } from '@/lib/berlinTime';
import { listAllGames } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export default async function AdminGamesPage() {
  const games = await listAllGames();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Oyunlar</h1>
      <p className="text-sm text-slate-600 mb-4">
        Herkese açık &quot;Oyun Bul&quot; bölümünde açılan oyunlar. Uygunsuz ya da sahte kayıtları buradan
        silebilirsiniz.
      </p>
      {games.length === 0 ? (
        <p className="text-slate-600">Henüz oyun açılmadı.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id} className="border rounded p-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/oyunlar/${game.id}`} className="font-semibold underline break-words">
                  {game.venue}
                </Link>
                <GameStatusBadge status={game.status} />
              </div>
              <p className="text-sm text-slate-700">{formatGameDate(game.startsAt)}</p>
              <p className="text-sm text-slate-600 break-words">
                {game.confirmed.length}/{game.capacity} oyuncu
                {game.waitlist.length > 0 && ` · ${game.waitlist.length} yedek`} · Organizatör:{' '}
                {game.organizerName} ({game.organizerContact})
              </p>
              <div className="mt-2">
                <AdminGameDeleteButton
                  gameId={game.id}
                  venue={game.venue}
                  date={formatGameDate(game.startsAt)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the admin nav link**

In `src/app/admin/layout.tsx`, after the line

```tsx
        <a href="/admin/haftalar" className="hover:underline">Haftalar</a>
```

add

```tsx
        <a href="/admin/oyunlar" className="hover:underline">Oyunlar</a>
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings or errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminGameDeleteButton.tsx src/app/admin/oyunlar src/app/admin/layout.tsx
git commit -m "feat(oyunlar): admin oyun listesi ve silme"
```

---

### Task 10: Full verification

**Files:** none (verification only; fix anything found in the task that owns the file, then re-run).

**Interfaces:**
- Consumes: everything above. Requires the migration from Task 4 Step 6 to be applied; if the user declined it, report this task as blocked after Step 1.

- [ ] **Step 1: Automated checks**

Run: `npm test`
Expected: all test files pass, including `berlinTime`, `games`, `gameTokens`.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings or errors.

Run: `npm run build`
Expected: build succeeds; route list includes `/oyunlar`, `/oyunlar/yeni`, `/oyunlar/[id]`, `/oyunlar/[id]/yonet`, `/admin/oyunlar`, `/api/games`, `/api/games/[id]`, `/api/games/[id]/participants`, `/api/games/[id]/participants/[pid]`, `/api/admin/games/[id]`.

- [ ] **Step 2: Manual run in the browser**

The games created here are real rows in the database from `.env`. Use an obviously fake venue name ("TEST — silinecek") and delete it at the end.

Run: `npm run dev` (in the background), open `http://localhost:3000/oyunlar`.

Check each line and record pass/fail:

1. "Oyun Bul" is in the menu; the empty list shows the "ilk oyunu siz açın" text and an "Oyun Oluştur" button.
2. Submitting the form with a past date, capacity 3, or cost "abc" shows a Turkish error and creates nothing.
3. Creating a game (capacity 4, cost 60, organizer free) lands on the detail page: organizer is player 1/4, the amber "Bu oyunu siz açtınız" box is visible, cost shows total 60,00 €, "şu an kişi başı —", "dolarsa 20,00 €".
4. "Oyun bağlantısını kopyala" puts the detail URL on the clipboard.
5. In a second browser profile (or private window), open the copied link: no amber box. Join as "Ali" → "Katıldınız!", 2/4, kişi başı 60,00 €. Joining again as " ali " shows the "zaten katılmış" error.
6. Join as two more names from other private windows → 4/4, "Dolu" badge, kişi başı 20,00 €, button reads "Yedek listesine katıl". One more join → appears under "Yedekler" with position 1; price unchanged.
7. In Ali's window press "Ayrıl" → the waitlisted person is now a confirmed player, waitlist empty.
8. Reload Ali's window → join form is shown again (no "Ayrıl").
9. In the organizer's window open "Oyunu yönet": change status to "Saha rezerve edildi" → badge changes on the detail page. Raise capacity to 6 and save → "Kaydedildi", detail shows x/6 and a lower "dolarsa" price. With 5 or more people in the game, lower capacity to 4 and save → the latest joiners appear under "Yedekler" and the per-person price rises. Remove one player with "Çıkar" → gone from the list. The organizer row has no "Çıkar".
10. Open `/oyunlar/<id>/yonet` without `?k=` and with a wrong `k` → 404 page.
11. "Oyunu iptal et" → detail shows "İptal edildi" and "Bu oyuna artık katılınamıyor"; the game is gone from `/oyunlar`.
12. Log in at `/login`, open `/admin/oyunlar` → the test game is listed; "Sil" removes it; its detail URL now returns 404.
13. At a 375 px wide viewport the list, form, detail and manage pages have no horizontal scroll.

- [ ] **Step 3: Report**

Stop the dev server. Report to the user: test/lint/build output, the pass/fail list from Step 2, and that the test game was deleted. Do not merge or push; ask how they want to integrate the branch.
