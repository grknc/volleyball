import Link from 'next/link';
import { prisma } from '@/lib/db';
import { PublicNav } from '@/components/PublicNav';
import { WeekStatusBadge } from '@/components/WeekSummary';
import type { WeekStatus } from '@/lib/constants';

export default async function ArchivePage() {
  const weeks = await prisma.week.findMany({
    where: { status: { not: 'draft' } },
    orderBy: { date: 'desc' },
  });
  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <h1 className="text-xl font-bold mb-4">Geçmiş Haftalar</h1>
      <ul className="flex flex-col gap-2">
        {weeks.map((week) => (
          <li key={week.id} className="flex items-center gap-2">
            <Link href={`/hafta/${week.id}`} className="underline">
              {new Date(week.date).toLocaleDateString('tr-TR')}
            </Link>
            <WeekStatusBadge status={week.status as WeekStatus} />
          </li>
        ))}
      </ul>
    </main>
  );
}
