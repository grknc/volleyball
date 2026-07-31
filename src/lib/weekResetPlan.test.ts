import { describe, expect, it } from 'vitest';
import { planWeekReset } from './weekResetPlan';

describe('planWeekReset', () => {
  it('keeps removeAttendees flag as-is', () => {
    expect(planWeekReset({ removeAttendees: true, resetStatus: false }, 'completed').removeAttendees).toBe(true);
    expect(planWeekReset({ removeAttendees: false, resetStatus: false }, 'completed').removeAttendees).toBe(false);
  });

  it('sets resultStatus to draft and updateStatus true when resetStatus is true', () => {
    const plan = planWeekReset({ removeAttendees: false, resetStatus: true }, 'archived');
    expect(plan.updateStatus).toBe(true);
    expect(plan.resultStatus).toBe('draft');
  });

  it('keeps the current status and updateStatus false when resetStatus is false', () => {
    const plan = planWeekReset({ removeAttendees: false, resetStatus: false }, 'archived');
    expect(plan.updateStatus).toBe(false);
    expect(plan.resultStatus).toBe('archived');
  });
});
