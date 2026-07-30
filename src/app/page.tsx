import { prisma } from '@/lib/db';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';
import { VolleyballInfo } from '@/components/VolleyballInfo';
import { PublicNav } from '@/components/PublicNav';

export default async function HomePage() {
  const latestWeek = await prisma.week.findFirst({ orderBy: { date: 'desc' } });

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      {!latestWeek ? (
        <p className="text-slate-600">Henüz hafta eklenmedi.</p>
      ) : (
        <WeekViewLoader weekId={latestWeek.id} />
      )}
      <VolleyballInfo />
    </main>
  );
}

async function WeekViewLoader({ weekId }: { weekId: string }) {
  const week = await getWeekView(weekId);
  if (!week) return null;
  return <WeekView week={week} />;
}
