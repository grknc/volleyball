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
