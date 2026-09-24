import Link from 'next/link';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { FormatBadge, LevelBadge } from '@/components/LevelBadge';
import { formatLevel } from '@/lib/rating';
import { PublicMatchEditor } from '@/components/PublicMatchEditor';
import { isWeekEditableForScores } from '@/lib/constants';
import type { WeekViewData } from '@/lib/weekView';

export function TeamRoster({ teamId, week }: { teamId: string; week: WeekViewData }) {
  const team = week.teams.find((t) => t.id === teamId);
  if (!team) return <>{teamId}</>;
  const avg = team.players.length > 0 ? team.players.reduce((s, p) => s + p.rating, 0) / team.players.length : 0;
  return (
    <details className="inline-block">
      <summary className="cursor-pointer underline decoration-dotted">
        {team.name}
        {team.players.length > 0 && (
          <span className="ml-1 text-[11px] font-normal text-slate-500">ort. {formatLevel(avg)}</span>
        )}
      </summary>
      <div className="mt-1.5 flex flex-wrap gap-1.5 font-normal">
        {team.players.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.id}`}
            className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full pl-0.5 pr-1 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
          >
            <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-5 h-5" />
            {p.name}
            <LevelBadge level={p.rating} size="xs" />
          </Link>
        ))}
      </div>
    </details>
  );
}

export function MatchResultContent({ match, week }: { match: WeekViewData['matches'][number]; week: WeekViewData }) {
  const teamAName = week.teams.find((t) => t.id === match.teamAId)?.name ?? '';
  const teamBName = week.teams.find((t) => t.id === match.teamBId)?.name ?? '';
  const winner = match.result?.winner;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <FormatBadge format={match.format} />
        {match.result && (
          <Link href={`/mac/${match.id}`} className="text-xs font-semibold text-blue-700">
            Maç detayı · seviye değişimleri →
          </Link>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className={`flex-1 text-sm ${winner === 'A' ? 'font-semibold' : 'text-slate-600'}`}>
          <TeamRoster teamId={match.teamAId} week={week} />
        </div>
        <div className="text-lg font-bold shrink-0 text-slate-900">
          {match.result ? `${match.result.setsWonA} — ${match.result.setsWonB}` : 'vs'}
        </div>
        <div className={`flex-1 text-sm text-right ${winner === 'B' ? 'font-semibold' : 'text-slate-600'}`}>
          <TeamRoster teamId={match.teamBId} week={week} />
        </div>
      </div>
      {match.result ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-emerald-700">
            ✓ {winner === 'A' ? teamAName : teamBName} kazandı
          </span>
          <div className="flex gap-1">
            {match.sets.map(([a, b], i) => (
              <span key={i} className="text-xs bg-slate-100 rounded px-1.5 py-0.5">
                {a}-{b}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-500 text-xs mt-2">Henüz oynanmadı</p>
      )}
    </>
  );
}

function MatchResultCard({ match, week }: { match: WeekViewData['matches'][number]; week: WeekViewData }) {
  return (
    <li className="border border-slate-200 rounded-lg p-3">
      <MatchResultContent match={match} week={week} />
    </li>
  );
}

export function WeekView({ week }: { week: WeekViewData }) {
  return (
    <div>
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Puan Durumu</h2>
        {week.teams.length === 0 ? (
          <p className="text-slate-500">Henüz takım oluşturulmadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Takım</th>
                  <th className="py-2">O</th>
                  <th className="py-2">G</th>
                  <th className="py-2">M</th>
                  <th className="py-2">Set Av.</th>
                  <th className="py-2">Puan</th>
                </tr>
              </thead>
              <tbody>
                {week.standings.map((row) => (
                  <tr key={row.teamId} className="border-b">
                    <td className="py-2">
                      <TeamRoster teamId={row.teamId} week={week} />
                    </td>
                    <td className="py-2">{row.played}</td>
                    <td className="py-2">{row.won}</td>
                    <td className="py-2">{row.lost}</td>
                    <td className="py-2">{row.setDiff}</td>
                    <td className="py-2 font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Maç Sonuçları</h2>
        {isWeekEditableForScores(week.status) ? (
          <PublicMatchEditor week={week} />
        ) : week.matches.length === 0 ? (
          <p className="text-slate-500">Henüz maç planlanmadı.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {week.matches.map((match) => (
              <MatchResultCard key={match.id} match={match} week={week} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Haftanın Oyuncusu</h2>
        {week.mvps.length === 0 ? (
          <p className="text-slate-500">Gelecek maç sonunda belirlenecek.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {week.mvps.map((mvp) => (
              <li
                key={mvp.id}
                className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
              >
                <PlayerAvatar name={mvp.name} avatarUrl={mvp.avatarUrl} sizeClassName="w-9 h-9" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">⭐ {mvp.name}</p>
                  {mvp.position && <p className="text-xs text-amber-700">{mvp.position}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
