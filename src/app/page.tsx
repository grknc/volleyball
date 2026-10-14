import { prisma } from '@/lib/db';
import { getWeekView, getNextWeekSummary } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';
import { WeekSummary, WeekStatusBadge } from '@/components/WeekSummary';
import { VolleyballInfo } from '@/components/VolleyballInfo';
import { PublicNav } from '@/components/PublicNav';
import { WeekAttendanceStrip, WeekBadgesSection } from '@/components/WeekExtras';
import { HomeGames } from '@/components/HomeGames';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const latestWeek = await prisma.week.findFirst({
    where: { status: { notIn: ['draft', 'archived'] } },
    orderBy: { date: 'desc' },
  });

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <HomeGames />
      {!latestWeek ? <NoActiveWeekMessage /> : <WeekViewLoader weekId={latestWeek.id} />}
      <NextEventSection afterDate={latestWeek?.date ?? new Date()} />
      <VolleyballInfo />
    </main>
  );
}

async function NoActiveWeekMessage() {
  const anyWeekExists = (await prisma.week.count()) > 0;
  return (
    <p className="text-slate-600">
      {anyWeekExists
        ? 'Taslak haftalar var, ancak henüz yayınlanmış bir hafta yok.'
        : 'Henüz hafta eklenmedi.'}
    </p>
  );
}

async function WeekViewLoader({ weekId }: { weekId: string }) {
  const week = await getWeekView(weekId);
  if (!week) return null;
  return (
    <>
      <WeekSummary week={week} footer={<WeekAttendanceStrip weekId={week.id} status={week.status} />} />
      {week.status !== 'cancelled' && <WeekView week={week} />}
      <WeekBadgesSection weekId={week.id} />
    </>
  );
}

async function NextEventSection({ afterDate }: { afterDate: Date }) {
  const nextWeek = await getNextWeekSummary(afterDate);
  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold mb-2">Sıradaki Etkinlik</h2>
      {nextWeek ? (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <span>{new Date(nextWeek.date).toLocaleDateString('tr-TR')}</span>
          <WeekStatusBadge status={nextWeek.status} />
        </div>
      ) : (
        <p className="text-slate-500 text-sm">Yeni etkinlik yakında açıklanacak.</p>
      )}
    </section>
  );
}
