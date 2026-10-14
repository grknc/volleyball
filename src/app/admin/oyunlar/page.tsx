import Link from 'next/link';
import { AdminGameDeleteButton } from '@/components/AdminGameDeleteButton';
import { GameStatusBadge } from '@/components/GameCard';
import { formatGameDate, formatGameTimeRange } from '@/lib/berlinTime';
import { listAllGames } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export default async function AdminGamesPage() {
  const games = await listAllGames();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Oyunlar</h1>
      <p className="text-sm text-slate-600 mb-4">
        Herkese açık &quot;Oyun Bul&quot; bölümünde açılan oyunlar. Uygunsuz ya da sahte kayıtları buradan
        silebilirsiniz.
      </p>
      {games.length === 0 ? (
        <p className="text-slate-600">Henüz oyun açılmadı.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id} className="border rounded p-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/oyunlar/${game.id}`} className="font-semibold underline break-words">
                  {game.venue}
                </Link>
                <GameStatusBadge status={game.status} />
              </div>
              <p className="text-sm text-slate-700">{formatGameTimeRange(game.startsAt, game.durationMinutes)}</p>
              <p className="text-sm text-slate-600 break-words">
                {game.confirmed.length}/{game.capacity} oyuncu
                {game.waitlist.length > 0 && ` · ${game.waitlist.length} yedek`} · Organizatör:{' '}
                {game.organizerName} ({game.organizerContact})
              </p>
              <div className="mt-2">
                <AdminGameDeleteButton
                  gameId={game.id}
                  venue={game.venue}
                  date={formatGameDate(game.startsAt)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
