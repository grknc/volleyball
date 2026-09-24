import { formatDelta, formatLevel } from '@/lib/rating';

const SIZES = {
  xs: 'text-[10px] px-1.5 py-0',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
} as const;

export function LevelBadge({ level, size = 'sm' }: { level: number; size?: keyof typeof SIZES }) {
  return (
    <span
      className={`inline-block rounded-full bg-lime-300 font-bold text-slate-900 tabular-nums leading-5 ${SIZES[size]}`}
      title="Seviye"
    >
      {formatLevel(level)}
    </span>
  );
}

export function DeltaBadge({ delta, className = '' }: { delta: number; className?: string }) {
  const rounded = Math.round(delta * 100) / 100;
  const tone =
    rounded > 0 ? 'text-emerald-700 bg-emerald-50' : rounded < 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-600 bg-slate-100';
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '•';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone} ${className}`}>
      <span className="text-[9px]">{arrow}</span>
      {formatDelta(delta)}
    </span>
  );
}

export function FormatBadge({ format }: { format: string }) {
  return (
    <span className="inline-block rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold px-1.5 py-0.5 tracking-wide">
      {format}
    </span>
  );
}
