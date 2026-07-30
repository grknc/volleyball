import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPlayerDetails } from '@/lib/playerService';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const player = await getPlayerDetails(params.id);
  if (!player) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/players" className="underline text-sm">
        ← Oyuncular
      </Link>

      <div className="flex items-center gap-4 my-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} sizeClassName="w-16 h-16" />
        <div>
          <h1 className="text-xl font-bold">{player.name}</h1>
          <p className="text-slate-600 text-sm">
            {player.position ?? 'Pozisyon belirtilmemiş'} · Seviye {player.level}
            {player.heightCm ? ` · ${player.heightCm} cm` : ''}
          </p>
        </div>
      </div>

      {process.env.NODE_ENV !== 'production' && player.integrityWarnings.length > 0 && (
        <p className="text-amber-700 text-sm mb-4">{player.integrityWarnings.join(' ')}</p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Katıldığı Hafta" value={player.weeksPlayed} />
        <Stat label="Toplam Maç" value={player.matchesPlayed} />
        <Stat label="Galibiyet" value={player.wins} />
        <Stat label="Mağlubiyet" value={player.losses} />
        <Stat label="Kazanma Oranı" value={`%${player.winRate.toFixed(0)}`} />
        <Stat label="Kazanılan Set" value={player.setsWon} />
        <Stat label="Kaybedilen Set" value={player.setsLost} />
        <Stat label="Set Averajı" value={player.setDiff} />
        <Stat label="Haftanın Oyuncusu" value={player.mvpCount} />
        <Stat label="Güncel Galibiyet Serisi" value={player.currentWinStreak} />
        <Stat label="En Uzun Galibiyet Serisi" value={player.longestWinStreak} />
        <Stat label="Kadroya Dahil Olduğu Hafta" value={player.weeksRegistered} />
      </section>

      <p className="text-sm text-slate-600 mb-6">
        İlk katılım:{' '}
        {player.firstAttendedDate ? new Date(player.firstAttendedDate).toLocaleDateString('tr-TR') : '-'}
        {' · '}
        Son katılım:{' '}
        {player.lastAttendedDate ? new Date(player.lastAttendedDate).toLocaleDateString('tr-TR') : '-'}
      </p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Son 10 Maç Performansı</h2>
        <div className="flex gap-1">
          {player.last10.map((r, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                r === 'W' ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              {r}
            </span>
          ))}
          {player.last10.length === 0 && <span className="text-slate-600 text-sm">Henüz maç yok</span>}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Son Oynadığı Maçlar</h2>
        {player.recentMatches.length === 0 ? (
          <p className="text-slate-600 text-sm">Henüz oynanmış maç yok.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2">Tarih</th>
                <th className="py-2">Takım</th>
                <th className="py-2">Rakip</th>
                <th className="py-2">Set</th>
                <th className="py-2">Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {player.recentMatches.map((m) => (
                <tr key={m.matchId} className="border-b">
                  <td className="py-2">{new Date(m.weekDate).toLocaleDateString('tr-TR')}</td>
                  <td className="py-2">{m.teamName}</td>
                  <td className="py-2">{m.opponentTeamName}</td>
                  <td className="py-2">{m.sets.map(([a, b]) => `${a}-${b}`).join(', ')}</td>
                  <td className="py-2">{m.won ? 'Kazandı' : 'Kaybetti'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Oynadığı Takımlar</h2>
        <ul className="text-sm space-y-1">
          {player.teamsPlayedFor.map((t) => (
            <li key={`${t.weekId}-${t.teamId}`}>
              {t.teamName} — {new Date(t.weekDate).toLocaleDateString('tr-TR')}
            </li>
          ))}
          {player.teamsPlayedFor.length === 0 && <li className="text-slate-600">Henüz takım kaydı yok.</li>}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Haftanın Oyuncusu Seçildiği Haftalar</h2>
        <ul className="text-sm space-y-1">
          {player.mvpWeeks.map((w) => (
            <li key={w.weekId}>{new Date(w.weekDate).toLocaleDateString('tr-TR')}</li>
          ))}
          {player.mvpWeeks.length === 0 && <li className="text-slate-600">Henüz seçilmedi.</li>}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
