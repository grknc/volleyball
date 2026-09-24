import { describe, expect, it } from 'vitest';
import { applyRsvp, capacityLabel, fillFromWaitlist, isValidCapacity, type RosterState } from './capacity';

const state = (over: Partial<RosterState> = {}): RosterState => ({
  capacity: 3,
  attendees: [],
  waitlist: [],
  absences: [],
  ...over,
});

describe('applyRsvp', () => {
  it('confirms while there is room, then waitlists in order', () => {
    let s = state();
    for (const id of ['a', 'b', 'c']) s = applyRsvp(s, id, 'yes').state;
    expect(s.attendees).toEqual(['a', 'b', 'c']);
    const d = applyRsvp(s, 'd', 'yes');
    expect(d.outcome).toBe('waitlisted');
    expect(d.waitlistPosition).toBe(1);
    const e = applyRsvp(d.state, 'e', 'yes');
    expect(e.waitlistPosition).toBe(2);
    expect(e.state.waitlist).toEqual(['d', 'e']);
  });

  it('no capacity means everyone is confirmed', () => {
    let s = state({ capacity: null });
    for (const id of ['a', 'b', 'c', 'd', 'e']) s = applyRsvp(s, id, 'yes').state;
    expect(s.attendees).toHaveLength(5);
    expect(s.waitlist).toEqual([]);
  });

  it('promotes the first waitlisted player when an attendee declines', () => {
    const s = state({ attendees: ['a', 'b', 'c'], waitlist: ['d', 'e'] });
    const r = applyRsvp(s, 'b', 'no');
    expect(r.outcome).toBe('declined');
    expect(r.promoted).toEqual(['d']);
    expect(r.state.attendees).toEqual(['a', 'c', 'd']);
    expect(r.state.waitlist).toEqual(['e']);
    expect(r.state.absences).toEqual(['b']);
  });

  it('leaving the waitlist promotes nobody and keeps the order', () => {
    const s = state({ attendees: ['a', 'b', 'c'], waitlist: ['d', 'e', 'f'] });
    const r = applyRsvp(s, 'e', 'none');
    expect(r.promoted).toEqual([]);
    expect(r.state.waitlist).toEqual(['d', 'f']);
  });

  it('saying yes again keeps the waitlist position', () => {
    const s = state({ attendees: ['a', 'b', 'c'], waitlist: ['d', 'e'] });
    const r = applyRsvp(s, 'd', 'yes');
    expect(r.waitlistPosition).toBe(1);
    expect(r.state.waitlist).toEqual(['d', 'e']);
  });

  it('a declined player saying yes is removed from absences', () => {
    const r = applyRsvp(state({ absences: ['a'] }), 'a', 'yes');
    expect(r.state.absences).toEqual([]);
    expect(r.state.attendees).toEqual(['a']);
  });

  it('admin can confirm over capacity (also from the waitlist)', () => {
    const s = state({ attendees: ['a', 'b', 'c'], waitlist: ['d'] });
    const r = applyRsvp(s, 'd', 'yes', { asAdmin: true });
    expect(r.outcome).toBe('confirmed');
    expect(r.state.attendees).toEqual(['a', 'b', 'c', 'd']);
    expect(r.state.waitlist).toEqual([]);
  });
});

describe('fillFromWaitlist', () => {
  it('fills up after a capacity increase, and all when unlimited', () => {
    const s = state({ capacity: 4, attendees: ['a', 'b', 'c'], waitlist: ['d', 'e'] });
    expect(fillFromWaitlist(s).promoted).toEqual(['d']);
    expect(fillFromWaitlist({ ...s, capacity: null }).promoted).toEqual(['d', 'e']);
  });

  it('never demotes when capacity is below the attendee count', () => {
    const s = state({ capacity: 2, attendees: ['a', 'b', 'c'], waitlist: ['d'] });
    const r = fillFromWaitlist(s);
    expect(r.state.attendees).toEqual(['a', 'b', 'c']);
    expect(r.promoted).toEqual([]);
  });
});

describe('helpers', () => {
  it('validates capacity', () => {
    expect(isValidCapacity(null)).toBe(true);
    expect(isValidCapacity(12)).toBe(true);
    expect(isValidCapacity(3)).toBe(false);
    expect(isValidCapacity(12.5)).toBe(false);
    expect(isValidCapacity('12')).toBe(false);
  });

  it('labels capacity with the best format', () => {
    expect(capacityLabel(12)).toBe('12 kişi · 2 takım × 6x6');
    expect(capacityLabel(18)).toBe('18 kişi · 3 takım × 6x6');
  });
});
