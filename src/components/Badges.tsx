import Link from 'next/link';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { BadgeTier, PlayerBadge, WeekBadgeHighlight } from '@/lib/badges';

const TIER_STYLE: Record<BadgeTier, string> = {
  bronz: 'from-amber-100 to-orange-200 border-orange-300',
  gümüş: 'from-slate-100 to-slate-300 border-slate-400',
  altın: 'from-yellow-100 to-yellow-300 border-yellow-400',
};

function formatProgress(b: PlayerBadge): string {
  const { metric, target } = b.def;
  if (metric === 'ratingGain') {
    const cur = Math.max(0, b.current);
    return `+${cur.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} / +${target.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  }
  return `${Math.min(b.current, target)} / ${target}`;
}

export function BadgeGrid({ badges }: { badges: PlayerBadge[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div>
      <p className="text-xs text-slate-500 mb-3">
        {earned.length} / {badges.length} rozet kazanıldı
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {earned.map((b) => (
          <div
            key={b.def.id}
            className={`rounded-xl border bg-gradient-to-br ${TIER_STYLE[b.def.tier]} p-2 text-center`}
            title={b.def.description}
          >
            <div className="text-3xl leading-none">{b.def.icon}</div>
            <p className="text-xs font-bold mt-1 leading-tight">{b.def.name}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {b.earnedAt ? new Date(b.earnedAt.date).toLocaleDateString('tr-TR') : ''}
            </p>
          </div>
        ))}
        {locked.map((b) => {
          const pct = Math.max(0, Math.min(100, (b.current / b.def.target) * 100));
          return (
            <div key={b.def.id} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2 text-center" title={b.def.description}>
              <div className="text-3xl leading-none grayscale opacity-40">{b.def.icon}</div>
              <p className="text-xs font-semibold mt-1 leading-tight text-slate-500">{b.def.name}</p>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{b.def.description}</p>
              <div className="h-1 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                <div className="h-full bg-slate-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{formatProgress(b)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekBadgeHighlights({ highlights }: { highlights: WeekBadgeHighlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-2">Bu Hafta Kazanılan Rozetler</h2>
      <ul className="flex flex-col gap-2">
        {highlights.map((h) => (
          <li key={h.playerId}>
            <Link
              href={`/players/${h.playerId}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-400"
            >
              <PlayerAvatar name={h.name} avatarUrl={h.avatarUrl} sizeClassName="w-8 h-8" />
              <span className="font-semibold text-sm flex-1">{h.name}</span>
              <span className="flex flex-wrap gap-1 justify-end">
                {h.badges.map((b) => (
                  <span
                    key={b.id}
                    className={`inline-flex items-center gap-1 rounded-full border bg-gradient-to-br ${TIER_STYLE[b.tier]} px-2 py-0.5 text-[11px] font-semibold`}
                    title={b.description}
                  >
                    {b.icon} {b.name}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
