import type { WeekViewData } from '@/lib/weekView';

export function WeekView({ week }: { week: WeekViewData }) {
  function teamName(id: string) {
    return week.teams.find((t) => t.id === id)?.name ?? id;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Puan Durumu</h2>
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
                <td className="py-2">{row.teamName}</td>
                <td className="py-2">{row.played}</td>
                <td className="py-2">{row.won}</td>
                <td className="py-2">{row.lost}</td>
                <td className="py-2">{row.setDiff}</td>
                <td className="py-2 font-semibold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Maç Sonuçları</h2>
        <ul className="flex flex-col gap-2">
          {week.matches.map((match) => (
            <li key={match.id} className="border rounded p-2">
              <span>
                {teamName(match.teamAId)} - {teamName(match.teamBId)}:{' '}
              </span>
              {match.result ? (
                <span className="font-semibold">
                  {match.result.setsWonA}-{match.result.setsWonB} (
                  {match.sets.map(([a, b]) => `${a}-${b}`).join(', ')})
                </span>
              ) : (
                <span className="text-slate-500">Henüz oynanmadı</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Haftanın Oyuncusu</h2>
        {week.mvps.length === 0 ? (
          <p className="text-slate-500">Henüz seçilmedi</p>
        ) : (
          <ul className="flex gap-2 flex-wrap">
            {week.mvps.map((mvp) => (
              <li key={mvp.id} className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-sm font-medium">
                ⭐ {mvp.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
