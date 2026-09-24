import { getWeekAttendance } from '@/lib/attendance';
import { badgesEarnedInWeek } from '@/lib/badges';
import { getRatingSnapshot } from '@/lib/ratingService';
import { AttendancePanel } from '@/components/AttendancePanel';
import { WeekBadgeHighlights } from '@/components/Badges';
import type { WeekStatus } from '@/lib/constants';

/** Yayındaki hafta için katılım kartı. */
export async function WeekAttendanceSection({ weekId, status }: { weekId: string; status: WeekStatus }) {
  if (status !== 'published') return null;
  const attendance = await getWeekAttendance(weekId);
  if (!attendance) return null;
  return <AttendancePanel initial={attendance} />;
}

/** O hafta kazanılan rozetler. */
export async function WeekBadgesSection({ weekId }: { weekId: string }) {
  const snapshot = await getRatingSnapshot();
  return <WeekBadgeHighlights highlights={badgesEarnedInWeek(snapshot, weekId)} />;
}
