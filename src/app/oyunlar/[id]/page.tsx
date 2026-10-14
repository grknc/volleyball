import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicNav } from '@/components/PublicNav';
import { FullBadge, GameStatusBadge } from '@/components/GameCard';
import { GameJoinPanel } from '@/components/GameJoinPanel';
import { GameOwnerBox } from '@/components/GameOwnerBox';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { formatGameTimeRange } from '@/lib/berlinTime';
import { formatEuro, type GameView } from '@/lib/games';
import { getGameView } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export default async function GamePage({ params }: { params: { id: string } }) {
  const game = await getGameView(params.id);
  if (!game) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <Link href="/oyunlar" className="text-sm underline">← Tüm oyunlar</Link>

      <header className="mt-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold break-words">{game.venue}</h1>
          <GameStatusBadge status={game.status} />
          {game.isFull && <FullBadge />}
        </div>
        <p className="text-slate-700">{formatGameTimeRange(game.startsAt, game.durationMinutes)}</p>
      </header>

      <div className="flex flex-col gap-4">
        <GameOwnerBox gameId={game.id} />
        <CostSection game={game} />

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Organizatör</h2>
          <p className="text-sm break-words">{game.organizerName}</p>
          <p className="text-sm text-slate-700 break-words">{game.organizerContact}</p>
        </section>

        <GameJoinPanel
          gameId={game.id}
          joinOpen={game.joinOpen}
          isFull={game.isFull}
          participantIds={[...game.confirmed, ...game.waitlist].map((p) => p.id)}
        />

        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold mb-2">
            Oyuncular ({game.confirmed.length}/{game.capacity})
          </h2>
          <ol className="list-decimal list-inside text-sm space-y-1">
            {game.confirmed.map((p) => (
              <li key={p.id} className="break-words">
                {p.name}
                {p.isOrganizer && <span className="text-xs text-slate-500"> · organizatör</span>}
                <ParticipantNote note={p.note} />
              </li>
            ))}
          </ol>
          {game.waitlist.length > 0 && (
            <>
              <h3 className="font-semibold mt-4 mb-2">Yedekler ({game.waitlist.length})</h3>
              <ol className="list-decimal list-inside text-sm space-y-1 text-slate-700">
                {game.waitlist.map((p) => (
                  <li key={p.id} className="break-words">
                    {p.name}
                    <ParticipantNote note={p.note} />
                  </li>
                ))}
              </ol>
              <p className="text-xs text-slate-500 mt-2">
                Biri ayrılınca listenin başındaki yedek kendiliğinden oyuncu olur.
              </p>
            </>
          )}
        </section>

        <CopyLinkButton path={`/oyunlar/${game.id}`} label="Oyun bağlantısını kopyala" />
      </div>
    </main>
  );
}

function ParticipantNote({ note }: { note: string | null }) {
  return note ? <span className="text-xs text-slate-500"> — {note}</span> : null;
}

function CostSection({ game }: { game: GameView }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <h2 className="font-semibold mb-2">Ücret</h2>
      {game.totalCostCents === 0 ? (
        <p className="text-sm">Ücretsiz</p>
      ) : (
        <>
          <ul className="text-sm space-y-1">
            <li className="flex justify-between gap-4">
              <span>Toplam saha bedeli</span>
              <span className="font-medium">{formatEuro(game.totalCostCents)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Şu an kişi başı ({game.cost.payers} kişi ödüyor)</span>
              <span className="font-medium">
                {game.cost.perPersonCents === null ? '—' : formatEuro(game.cost.perPersonCents)}
              </span>
            </li>
            {game.cost.perPersonWhenFullCents !== null && (
              <li className="flex justify-between gap-4">
                <span>Oyun dolarsa kişi başı</span>
                <span className="font-medium">{formatEuro(game.cost.perPersonWhenFullCents)}</span>
              </li>
            )}
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            {game.organizerFree
              ? 'Organizatör ücret ödemez; saha bedeli diğer oyuncular arasında bölünür. '
              : 'Saha bedeli organizatör dahil tüm oyuncular arasında bölünür. '}
            Yedekler ödemez. Kişi başı ücret, katılan oyuncu sayısı değiştikçe değişir.
          </p>
        </>
      )}
      {game.paymentNote && (
        <p className="text-sm mt-3 break-words">
          <span className="font-medium">Ödeme: </span>
          {game.paymentNote}
        </p>
      )}
    </section>
  );
}
