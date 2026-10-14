import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { GameManagePanel } from '@/components/GameManagePanel';
import { berlinParts } from '@/lib/berlinTime';
import { euroAmount } from '@/lib/games';
import { getGameView, isManageTokenValid } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

// Adres gizli anahtar taşır: arama motorlarına ve başka sitelere sızmasın.
export const metadata: Metadata = {
  title: 'Oyunu Yönet',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ManageGamePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { k?: string | string[] };
}) {
  const token = typeof searchParams.k === 'string' ? searchParams.k : '';
  if (!(await isManageTokenValid(params.id, token))) notFound();

  const game = await getGameView(params.id);
  if (!game) notFound();

  const { date, time } = berlinParts(new Date(game.startsAt));

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href={`/oyunlar/${game.id}`} className="text-sm underline">← Oyun sayfası</Link>
      <h1 className="text-xl font-bold mt-2 mb-4 break-words">Oyunu Yönet: {game.venue}</h1>
      <GameManagePanel
        game={game}
        manageToken={token}
        initial={{
          venue: game.venue,
          date,
          time,
          durationMinutes: String(game.durationMinutes),
          capacity: String(game.capacity),
          totalCost: euroAmount(game.totalCostCents),
          organizerFree: game.organizerFree,
          organizerName: game.organizerName,
          organizerContact: game.organizerContact,
          organizerNote: game.confirmed.find((p) => p.isOrganizer)?.note ?? '',
          paymentNote: game.paymentNote ?? '',
        }}
      />
    </main>
  );
}
