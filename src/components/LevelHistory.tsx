'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatLevel } from '@/lib/rating';
import { DeltaBadge } from '@/components/LevelBadge';

interface Point {
  matchId: string;
  date: string;
  level: number;
  delta: number;
  won: boolean;
}

const TABS = [
  { key: 5, label: '5 Sonuç' },
  { key: 10, label: '10 Sonuç' },
  { key: 0, label: 'Tümü' },
] as const;

export function LevelHistory({ history, baseLevel }: { history: Point[]; baseLevel: number }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(5);

  if (history.length === 0) {
    return <p className="text-sm text-slate-500">İlk maçın sonucu girildiğinde seviye gelişimi burada görünecek.</p>;
  }

  const shown = tab === 0 ? history : history.slice(-tab);
  const startLevel = history.length > shown.length ? history[history.length - shown.length - 1].level : baseLevel;
  const series = [startLevel, ...shown.map((p) => p.level)];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`text-xs font-semibold rounded-full px-3 py-1 border transition ${
              tab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Sparkline values={series} />

      <ul className="mt-3 divide-y divide-slate-100">
        {[...shown].reverse().map((p) => (
          <li key={p.matchId}>
            <Link href={`/mac/${p.matchId}`} className="flex items-center justify-between py-2 text-sm hover:bg-slate-50 rounded px-1">
              <span className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
                    p.won ? 'bg-emerald-600' : 'bg-rose-500'
                  }`}
                >
                  {p.won ? 'G' : 'M'}
                </span>
                <span className="text-slate-600">{new Date(p.date).toLocaleDateString('tr-TR')}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{formatLevel(p.level)}</span>
                <DeltaBadge delta={p.delta} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 320;
  const h = 90;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.2, max - min);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(values.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;
  const up = values[values.length - 1] >= values[0];

  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" role="img" aria-label="Seviye gelişim grafiği">
        <defs>
          <linearGradient id="lvlFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={up ? '#84cc16' : '#f43f5e'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={up ? '#84cc16' : '#f43f5e'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lvlFill)" />
        <path d={d} fill="none" stroke={up ? '#65a30d' : '#e11d48'} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.5} fill={up ? '#65a30d' : '#e11d48'} />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-slate-500 px-1">
        <span>{formatLevel(values[0])}</span>
        <span className="font-semibold text-slate-800">{formatLevel(values[values.length - 1])}</span>
      </div>
    </div>
  );
}
