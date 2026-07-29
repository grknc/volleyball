import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function WeeksListPage() {
  const weeks = await prisma.week.findMany({ orderBy: { date: 'desc' } });
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Haftalar</h1>
        <Link href="/admin/haftalar/yeni" className="bg-slate-900 text-white rounded px-3 py-1">
          Yeni Hafta
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {weeks.map((week) => (
          <li key={week.id}>
            <Link href={`/admin/haftalar/${week.id}`} className="underline">
              {new Date(week.date).toLocaleDateString('tr-TR')}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
