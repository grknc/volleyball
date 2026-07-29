import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';

export default async function HomePage() {
  const latestWeek = await prisma.week.findFirst({ orderBy: { date: 'desc' } });

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Haftalık Voleybol</h1>
        <Link href="/arsiv" className="underline text-sm">
          Geçmiş Haftalar
        </Link>
      </div>
      {!latestWeek ? (
        <p className="text-slate-600">Henüz hafta eklenmedi.</p>
      ) : (
        <WeekViewLoader weekId={latestWeek.id} />
      )}
    </main>
  );
}

async function WeekViewLoader({ weekId }: { weekId: string }) {
  const week = await getWeekView(weekId);
  if (!week) return null;
  return <WeekView week={week} />;
}
