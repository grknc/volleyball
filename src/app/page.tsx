import { prisma } from '@/lib/db';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';
import { WeekSummary } from '@/components/WeekSummary';
import { VolleyballInfo } from '@/components/VolleyballInfo';
import { PublicNav } from '@/components/PublicNav';

export default async function HomePage() {
  const latestWeek = await prisma.week.findFirst({
    where: { status: { notIn: ['draft', 'archived'] } },
    orderBy: { date: 'desc' },
  });

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      {!latestWeek ? <NoActiveWeekMessage /> : <WeekViewLoader weekId={latestWeek.id} />}
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
      <WeekSummary week={week} />
      {week.status !== 'cancelled' && <WeekView week={week} />}
    </>
  );
}
