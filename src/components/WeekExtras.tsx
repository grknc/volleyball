import Link from 'next/link';
import { getWeekAttendance } from '@/lib/attendance';
import { attendanceSummary } from '@/lib/attendanceSummary';
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

/** Ana sayfa için tek satırlık katılım özeti; tam panel haftanın sayfasında. */
export async function WeekAttendanceStrip({ weekId, status }: { weekId: string; status: WeekStatus }) {
  if (status !== 'published') return null;
  const attendance = await getWeekAttendance(weekId);
  if (!attendance) return null;
  const { text, linkLabel } = attendanceSummary({
    coming: attendance.coming.length,
    capacity: attendance.capacity,
    waitlist: attendance.waitlist.length,
    open: attendance.open,
  });
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
      <span className="text-slate-700">{text}</span>
      <Link href={`/hafta/${weekId}`} className="font-medium text-blue-700 hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}

/** O hafta kazanılan rozetler. */
export async function WeekBadgesSection({ weekId }: { weekId: string }) {
  const snapshot = await getRatingSnapshot();
  return <WeekBadgeHighlights highlights={badgesEarnedInWeek(snapshot, weekId)} />;
}
