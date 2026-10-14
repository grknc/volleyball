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
