import Link from 'next/link';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { DeltaBadge, FormatBadge, LevelBadge } from '@/components/LevelBadge';
import type { ProfileMatchCard as Card, ProfileMatchSide } from '@/lib/playerProfile';

function SideRow({ side, highlightId }: { side: ProfileMatchSide; highlightId: string }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${side.won ? '' : 'opacity-80'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1 truncate">
          {side.teamName} {side.won && <span className="text-emerald-600">• Kazandı</span>}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {side.players.map((p) => (
            <Link key={p.id} href={`/players/${p.id}`} className="flex items-center gap-1.5 min-w-0">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} sizeClassName="w-7 h-7" />
              <span className="flex flex-col leading-tight">
                <span className={`text-xs truncate max-w-[88px] ${p.id === highlightId ? 'font-bold' : 'text-slate-700'}`}>
                  {p.name.split(' ')[0]}
                </span>
                <LevelBadge level={p.level} size="xs" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {side.sets.map((s, i) => (
          <span
            key={i}
            className={`w-7 text-center text-lg tabular-nums ${side.won ? 'font-bold text-slate-900' : 'text-slate-400'}`}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProfileMatchCard({ card, playerId }: { card: Card; playerId: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FormatBadge format={card.format} />
          <span>{new Date(card.weekDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <span
          className={`text-xs font-bold rounded-full px-2 py-0.5 ${
            card.won ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {card.won ? 'Galibiyet' : 'Mağlubiyet'}
        </span>
      </header>
      <div className="divide-y divide-slate-100">
        <SideRow side={card.mine} highlightId={playerId} />
        <SideRow side={card.opponent} highlightId={playerId} />
      </div>
      <footer className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>
          Kazanma beklentisi %{Math.round(card.expected * 100)} · +{card.pointsEarned} puan
        </span>
        <span className="flex items-center gap-2">
          <DeltaBadge delta={card.delta} />
          <Link href={`/mac/${card.matchId}`} className="font-semibold text-blue-700">
            Detay →
          </Link>
        </span>
      </footer>
    </article>
  );
}
