import { suggestFormats } from './teamBalancer';

/**
 * Kontenjan + yedek listesi mantığı (saf fonksiyonlar, DB'den bağımsız).
 *
 * - attendees : kesin katılımcılar (WeekAttendee)
 * - waitlist  : yedekler, sıra önemli (WeekWaitlist, createdAt'e göre)
 * - absences  : "Gelmiyorum" diyenler (WeekAbsence)
 */

export const CAPACITY_MIN = 4;
export const CAPACITY_MAX = 60;
export const CAPACITY_PRESETS = [8, 12, 16, 18, 24] as const;

export type Choice = 'yes' | 'no' | 'none';

export interface RosterState {
  capacity: number | null;
  attendees: string[];
  waitlist: string[];
  absences: string[];
}

export type RsvpOutcome = 'confirmed' | 'waitlisted' | 'declined' | 'cleared';

export interface RsvpResult {
  state: RosterState;
  outcome: RsvpOutcome;
  /** Yedekten katılımcılığa geçenler (sırasıyla) */
  promoted: string[];
  /** Yedekse sırası (1'den başlar) */
  waitlistPosition: number | null;
}

export function isValidCapacity(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isInteger(value) && value >= CAPACITY_MIN && value <= CAPACITY_MAX)
  );
}

export function hasRoom(state: RosterState): boolean {
  return state.capacity === null || state.attendees.length < state.capacity;
}

/** Boş yer oldukça yedek listesinin başındakileri katılımcı yapar. */
export function fillFromWaitlist(state: RosterState): { state: RosterState; promoted: string[] } {
  const attendees = [...state.attendees];
  const waitlist = [...state.waitlist];
  const promoted: string[] = [];
  while (waitlist.length > 0 && (state.capacity === null || attendees.length < state.capacity)) {
    const next = waitlist.shift()!;
    attendees.push(next);
    promoted.push(next);
  }
  return { state: { ...state, attendees, waitlist }, promoted };
}

export function applyRsvp(
  state: RosterState,
  playerId: string,
  choice: Choice,
  { asAdmin = false }: { asAdmin?: boolean } = {}
): RsvpResult {
  const without = (list: string[]) => list.filter((id) => id !== playerId);
  const wasAttendee = state.attendees.includes(playerId);
  const wasWaitlisted = state.waitlist.includes(playerId);

  if (choice === 'yes') {
    const absences = without(state.absences);
    if (wasAttendee) {
      return { state: { ...state, absences }, outcome: 'confirmed', promoted: [], waitlistPosition: null };
    }
    // Admin kontenjanı aşarak da doğrudan ekleyebilir.
    if (asAdmin || hasRoom(state)) {
      return {
        state: { ...state, attendees: [...state.attendees, playerId], waitlist: without(state.waitlist), absences },
        outcome: 'confirmed',
        promoted: [],
        waitlistPosition: null,
      };
    }
    const waitlist = wasWaitlisted ? state.waitlist : [...state.waitlist, playerId];
    return {
      state: { ...state, waitlist, absences },
      outcome: 'waitlisted',
      promoted: [],
      waitlistPosition: waitlist.indexOf(playerId) + 1,
    };
  }

  const removed: RosterState = {
    ...state,
    attendees: without(state.attendees),
    waitlist: without(state.waitlist),
    absences: choice === 'no' ? [...without(state.absences), playerId] : without(state.absences),
  };
  const filled = wasAttendee ? fillFromWaitlist(removed) : { state: removed, promoted: [] };
  return {
    state: filled.state,
    outcome: choice === 'no' ? 'declined' : 'cleared',
    promoted: filled.promoted,
    waitlistPosition: null,
  };
}

export function capacityLabel(capacity: number): string {
  const best = suggestFormats(capacity, 1)[0];
  return best ? `${capacity} kişi · ${best.label}` : `${capacity} kişi`;
}
