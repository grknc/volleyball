import type { WeekStatus } from './constants';

export interface WeekResetOptions {
  removeAttendees: boolean;
  resetStatus: boolean;
}

export interface WeekResetPlan {
  removeAttendees: boolean;
  updateStatus: boolean;
  resultStatus: WeekStatus;
}

export function planWeekReset(options: WeekResetOptions, currentStatus: WeekStatus): WeekResetPlan {
  return {
    removeAttendees: options.removeAttendees,
    updateStatus: options.resetStatus,
    resultStatus: options.resetStatus ? 'draft' : currentStatus,
  };
}
