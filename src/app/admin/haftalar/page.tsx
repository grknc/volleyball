import Link from 'next/link';
import { prisma } from '@/lib/db';
import { WeekStatusBadge } from '@/components/WeekSummary';
import { WeekRowActions } from '@/components/WeekRowActions';
import type { WeekStatus } from '@/lib/constants';

export default async function WeeksListPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const showArchived = searchParams.filter === 'archived';

  const weeks = await prisma.week.findMany({
    where: showArchived ? { status: 'archived' } : { status: { not: 'archived' } },
    orderBy: { date: 'desc' },
    include: { _count: { select: { attendees: true, teams: true, matches: true } } },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Haftalar</h1>
        <Link href="/admin/haftalar/yeni" className="bg-slate-900 text-white rounded px-3 py-1">
          Yeni Hafta
        </Link>
      </div>

      <div className="flex gap-4 mb-4 text-sm">
        <Link href="/admin/haftalar" className={!showArchived ? 'font-semibold underline' : 'underline'}>
          Aktif
        </Link>
        <Link
          href="/admin/haftalar?filter=archived"
          className={showArchived ? 'font-semibold underline' : 'underline'}
        >
          Arşivlenenler
        </Link>
      </div>

      {weeks.length === 0 ? (
        <p className="text-slate-600">
          {showArchived ? 'Arşivlenmiş hafta yok.' : 'Henüz hafta eklenmedi.'}
        </p>
      ) : (
        <>
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="border-b">
                <th className="py-2">Tarih</th>
                <th className="py-2">Durum</th>
                <th className="py-2">Oyuncu</th>
                <th className="py-2">Takım</th>
                <th className="py-2">Maç</th>
                <th className="py-2">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.id} className="border-b">
                  <td className="py-2">{new Date(week.date).toLocaleDateString('tr-TR')}</td>
                  <td className="py-2">
                    <WeekStatusBadge status={week.status as WeekStatus} />
                  </td>
                  <td className="py-2">{week._count.attendees}</td>
                  <td className="py-2">{week._count.teams}</td>
                  <td className="py-2">{week._count.matches}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      {week.status !== 'draft' ? (
                        <Link href={`/hafta/${week.id}`} className="text-sm underline">
                          Görüntüle
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">Görüntüle</span>
                      )}
                      <Link href={`/admin/haftalar/${week.id}`} className="text-sm underline">
                        Düzenle
                      </Link>
                      <WeekRowActions
                        weekId={week.id}
                        weekDate={new Date(week.date).toLocaleDateString('tr-TR')}
                        attendeeCount={week._count.attendees}
                        teamCount={week._count.teams}
                        matchCount={week._count.matches}
                        isArchived={week.status === 'archived'}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden flex flex-col gap-3">
            {weeks.map((week) => (
              <div key={week.id} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{new Date(week.date).toLocaleDateString('tr-TR')}</span>
                  <WeekStatusBadge status={week.status as WeekStatus} />
                </div>
                <p className="text-sm text-slate-600 mb-2">
                  {week._count.attendees} oyuncu · {week._count.teams} takım · {week._count.matches} maç
                </p>
                <div className="flex items-center gap-3 mb-2">
                  {week.status !== 'draft' ? (
                    <Link href={`/hafta/${week.id}`} className="text-sm underline">
                      Görüntüle
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">Görüntüle</span>
                  )}
                  <Link href={`/admin/haftalar/${week.id}`} className="text-sm underline">
                    Düzenle
                  </Link>
                </div>
                <WeekRowActions
                  weekId={week.id}
                  weekDate={new Date(week.date).toLocaleDateString('tr-TR')}
                  attendeeCount={week._count.attendees}
                  teamCount={week._count.teams}
                  matchCount={week._count.matches}
                  isArchived={week.status === 'archived'}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
