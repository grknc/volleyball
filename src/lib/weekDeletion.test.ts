import { describe, expect, it } from 'vitest';
import { canDeleteWeek } from './weekDeletion';

describe('canDeleteWeek', () => {
  it('allows deletion of a week with no matches at all', () => {
    expect(canDeleteWeek([])).toBe(true);
  });

  it('allows deletion of a week whose matches have no scores entered yet', () => {
    expect(canDeleteWeek([{ sets: [] }, { sets: [[10, 8]] }])).toBe(true);
  });

  it('blocks deletion when any match has a completed result', () => {
    expect(
      canDeleteWeek([
        { sets: [] },
        {
          sets: [
            [25, 20],
            [25, 18],
          ],
        },
      ])
    ).toBe(false);
  });

  it('blocks deletion even if only one of several matches is completed', () => {
    expect(
      canDeleteWeek([
        {
          sets: [
            [25, 10],
            [20, 25],
            [15, 12],
          ],
        },
        { sets: [[5, 3]] },
      ])
    ).toBe(false);
  });
});
