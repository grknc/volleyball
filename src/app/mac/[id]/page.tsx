import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getRatingSnapshot } from '@/lib/ratingService';
import { computeMatchResult, isCompletedMatch, type SetScore } from '@/lib/matchScoring';
import { formatLabel, formatLevel } from '@/lib/rating';
import { PublicNav } from '@/components/PublicNav';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { DeltaBadge, FormatBadge, LevelBadge } from '@/components/LevelBadge';

export const dynamic = 'force-dynamic';

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      week: true,
      teamA: { include: { players: { include: { player: true } } } },
      teamB: { include: { players: { include: { player: true } } } },
    },
  });
  if (!match) notFound();

  const snapshot = await getRatingSnapshot();
  const rated = snapshot.matches.get(match.id);
  const sets = match.sets as SetScore[];
  const completed = isCompletedMatch({ sets });
  const result = completed ? computeMatchResult(sets) : null;
  const byPlayer = new Map(rated?.players.map((p) => [p.playerId, p]) ?? []);
  const format = rated?.format ?? formatLabel(match.teamA.players.length, match.teamB.players.length);

  const teamLevel = (ids: string[]) => {
    if (ids.length === 0) return 0;
    return ids.reduce((s, id) => s + (snapshot.players.get(id)?.rating ?? 5), 0) / ids.length;
  };
  const avgA = rated?.teamAAvg ?? teamLevel(match.teamA.players.map((p) => p.playerId));
  const avgB = rated?.teamBAvg ?? teamLevel(match.teamB.players.map((p) => p.playerId));
  const expectedA = rated?.expectedA ?? 1 / (1 + Math.pow(10, (avgB - avgA) / 3));

  const sides = [
    { key: 'A' as const, team: match.teamA, avg: avgA, exp: expectedA },
    { key: 'B' as const, team: match.teamB, avg: avgB, exp: 1 - expectedA },
  ];

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      <PublicNav />
      <Link href={`/hafta/${match.weekId}`} className="text-sm text-slate-600 hover:text-slate-900">
        ← {new Date(match.week.date).toLocaleDateString('tr-TR')} haftası
      </Link>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 mt-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <FormatBadge format={format} />
          <span>{new Date(match.week.date).toLocaleDateString('tr-TR', { dateStyle: 'full' })}</span>
          {match.targetPoints && <span>· {match.targetPoints} sayılık setler</span>}
        </div>

        <div className="divide-y divide-slate-100">
          {sides.map((side) => {
            const won = result?.winner === side.key;
            return (
              <div key={side.key} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold ${won ? 'text-slate-900' : 'text-slate-500'}`}>
                    {side.team.name} {won && <span className="text-emerald-600 text-sm">✓ Kazandı</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    Ortalama seviye {formatLevel(side.avg)} · Beklenti %{Math.round(side.exp * 100)}
                  </p>
                </div>
                <div className="flex gap-3">
                  {sets.map((s, i) => {
                    const mine = side.key === 'A' ? s[0] : s[1];
                    const other = side.key === 'A' ? s[1] : s[0];
                    return (
                      <span
                        key={i}
                        className={`w-8 text-center text-2xl tabular-nums ${mine > other ? 'font-extrabold' : 'text-slate-400'}`}
                      >
                        {mine}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!completed && <p className="text-sm text-slate-500 mt-2">Bu maç henüz tamamlanmadı.</p>}

        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-blue-600" style={{ width: `${expectedA * 100}%` }} />
            <div className="bg-lime-400 flex-1" />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Maç öncesi seviyelere göre kazanma olasılığı</p>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        {sides.map((side) => (
          <section key={side.key} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
            <h2 className="font-bold mb-3">{side.team.name}</h2>
            <ul className="space-y-2">
              {side.team.players.map(({ player }) => {
                const r = byPlayer.get(player.id);
                return (
                  <li key={player.id}>
                    <Link href={`/players/${player.id}`} className="flex items-center gap-3 rounded-xl hover:bg-slate-50 p-1">
                      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} sizeClassName="w-10 h-10" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{player.name}</p>
                        <p className="text-xs text-slate-500">{player.position ?? '—'}</p>
                      </div>
                      {r ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <LevelBadge level={r.before} size="xs" />
                            <span className="text-slate-400 text-xs">→</span>
                            <LevelBadge level={r.after} size="xs" />
                          </div>
                          <DeltaBadge delta={r.delta} className="mt-1" />
                        </div>
                      ) : (
                        <LevelBadge level={snapshot.players.get(player.id)?.rating ?? player.level} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
