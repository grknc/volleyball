import Link from 'next/link';
import { GameCard } from '@/components/GameCard';
import { listUpcomingGames } from '@/lib/gameService';

const PREVIEW_COUNT = 3;

/** Ana sayfanın üstünde yaklaşan oyunlar; açık oyun yoksa hiç görünmez. */
export async function HomeGames() {
  const games = await listUpcomingGames();
  if (games.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="home-games-title">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 id="home-games-title" className="text-lg font-semibold">
          Yaklaşan Oyunlar
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/oyunlar" className="font-medium text-blue-700 hover:underline">
            Tümünü gör ({games.length}) →
          </Link>
          <Link href="/oyunlar/yeni" className="rounded-lg bg-blue-700 px-3 py-1.5 text-white">
            Oyun Oluştur
          </Link>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {games.slice(0, PREVIEW_COUNT).map((game) => (
          <li key={game.id}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
    </section>
  );
}
