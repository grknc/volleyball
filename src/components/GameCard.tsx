import Link from 'next/link';
import { formatGameTimeRange } from '@/lib/berlinTime';
import { GAME_STATUS_LABELS, gameListPriceLabel, type GameStatus, type GameView } from '@/lib/games';

const STATUS_STYLES: Record<GameStatus, string> = {
  searching: 'bg-amber-100 text-amber-800',
  reserved: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export function GameStatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[status]}`}>
      {GAME_STATUS_LABELS[status]}
    </span>
  );
}

export function FullBadge() {
  return <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-blue-100 text-blue-800">Dolu</span>;
}

export function GameCard({ game }: { game: GameView }) {
  return (
    <Link
      href={`/oyunlar/${game.id}`}
      className="block bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-blue-400"
    >
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h2 className="font-semibold break-words">{game.venue}</h2>
        <GameStatusBadge status={game.status} />
        {game.isFull && <FullBadge />}
      </div>
      <p className="text-sm text-slate-700">{formatGameTimeRange(game.startsAt, game.durationMinutes)}</p>
      <p className="text-sm text-slate-600 mt-1">
        {game.confirmed.length}/{game.capacity} oyuncu
        {game.waitlist.length > 0 && ` · ${game.waitlist.length} yedek`} · {gameListPriceLabel(game)}
      </p>
      <p className="text-xs text-slate-500 mt-1 break-words">Organizatör: {game.organizerName}</p>
    </Link>
  );
}
