import { describe, expect, it } from 'vitest';
import { attendanceSummary } from './attendanceSummary';

describe('attendanceSummary', () => {
  it('shows coming over capacity and the waitlist', () => {
    expect(attendanceSummary({ coming: 48, capacity: 48, waitlist: 3, open: true })).toEqual({
      text: 'Katılım: 48/48 geliyor · 3 yedek',
      linkLabel: 'Katılım durumunu bildir →',
    });
  });

  it('leaves out the waitlist when it is empty', () => {
    expect(attendanceSummary({ coming: 20, capacity: 24, waitlist: 0, open: true }).text).toBe(
      'Katılım: 20/24 geliyor'
    );
  });

  it('shows only the count when there is no capacity', () => {
    expect(attendanceSummary({ coming: 31, capacity: null, waitlist: 0, open: true }).text).toBe(
      'Katılım: 31 geliyor'
    );
  });

  it('points to the list instead of replying when attendance is closed', () => {
    expect(attendanceSummary({ coming: 48, capacity: 48, waitlist: 0, open: false }).linkLabel).toBe(
      'Katılım listesini gör →'
    );
  });
});
