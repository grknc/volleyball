import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicNav } from '@/components/PublicNav';
import { GameCard } from '@/components/GameCard';
import { listUpcomingGames } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Oyun Bul' };

export default async function GamesPage() {
  const games = await listUpcomingGames();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">Oyun Bul</h1>
        <Link href="/oyunlar/yeni" className="bg-blue-700 text-white rounded-lg px-4 py-2">
          Oyun Oluştur
        </Link>
      </div>
      {games.length === 0 ? (
        <p className="text-slate-600">
          Şu an yaklaşan bir oyun yok. İlk oyunu siz açın ve bağlantısını paylaşın.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id}>
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
