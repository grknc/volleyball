import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';
import { WeekSummary } from '@/components/WeekSummary';
import { PublicNav } from '@/components/PublicNav';
import { WeekAttendanceSection, WeekBadgesSection } from '@/components/WeekExtras';

export const dynamic = 'force-dynamic';

export default async function WeekPage({ params }: { params: { weekId: string } }) {
  const week = await getWeekView(params.weekId);
  if (!week || week.status === 'draft') notFound();
  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href="/arsiv" className="underline text-sm">
        ← Tüm Haftalar
      </Link>
      <div className="mt-4">
        <WeekSummary week={week} />
        <WeekAttendanceSection weekId={week.id} status={week.status} />
        {week.status !== 'cancelled' && <WeekView week={week} />}
        <WeekBadgesSection weekId={week.id} />
      </div>
    </main>
  );
}
