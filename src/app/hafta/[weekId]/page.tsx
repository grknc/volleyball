import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';

export default async function WeekPage({ params }: { params: { weekId: string } }) {
  const week = await getWeekView(params.weekId);
  if (!week) notFound();
  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/arsiv" className="underline text-sm">
        ← Tüm Haftalar
      </Link>
      <div className="mt-4">
        <WeekView week={week} />
      </div>
    </main>
  );
}
