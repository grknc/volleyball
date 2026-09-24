'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PublicNav } from '@/components/PublicNav';
import { LevelBadge } from '@/components/LevelBadge';
import { PLAYER_POSITIONS } from '@/lib/constants';

interface PlayerListItem {
  id: string;
  name: string;
  position: string | null;
  level: number;
  avatarUrl: string | null;
  isActive: boolean;
  weeksPlayed: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  mvpCount: number;
  rating: number;
  reliability: number;
  points: number;
  rank: number | null;
  badgeCount: number;
  recentBadges: string[];
}

interface PlayersResponse {
  players: PlayerListItem[];
  total: number;
  limit: number;
  offset: number;
  minMatchesForWinRate: number;
}

const PAGE_SIZE = 20;
const SKILL_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

const SORT_OPTIONS = [
  { value: 'level', label: 'Seviye' },
  { value: 'points', label: 'Puan' },
  { value: 'matches', label: 'En Çok Maç' },
  { value: 'wins', label: 'En Çok Galibiyet' },
  { value: 'winRate', label: 'Kazanma Oranı' },
  { value: 'mvps', label: 'Haftanın Oyuncusu' },
  { value: 'name', label: 'Alfabetik' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export default function PlayersPage() {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('level');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sortBy');
    if (s && SORT_OPTIONS.some((o) => o.value === s)) setSortBy(s as SortValue);
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [search, position, skillLevel, sortBy]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (position) params.set('position', position);
    if (skillLevel) params.set('skillLevel', skillLevel);
    params.set('sortBy', sortBy);
    params.set('order', sortBy === 'name' ? 'asc' : 'desc');
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));

    fetch(`/api/players?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error('Oyuncular yüklenemedi');
        return res.json();
      })
      .then((json: PlayersResponse) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, position, skillLevel, sortBy, offset]);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6">
      <PublicNav />
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Oyuncular</h1>
        {data && <span className="text-sm text-slate-500">{data.total} oyuncu</span>}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍  İsme göre ara"
        aria-label="Oyuncu ara"
        className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm mb-3"
      />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSortBy(opt.value)}
            aria-pressed={sortBy === opt.value}
            className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border ${
              sortBy === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          aria-label="Pozisyona göre filtrele"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tüm Pozisyonlar</option>
          {PLAYER_POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={skillLevel}
          onChange={(e) => setSkillLevel(e.target.value)}
          aria-label="Seviyeye göre filtrele"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Tüm Seviyeler</option>
          {SKILL_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              Seviye {lvl},00 – {lvl},99
            </option>
          ))}
        </select>
      </div>

      {sortBy === 'winRate' && data && (
        <p className="text-xs text-slate-500 mb-3">En az {data.minMatchesForWinRate} maç oynamış oyuncular arasında.</p>
      )}

      {loading && (
        <div className="space-y-2" role="status" aria-label="Yükleniyor">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && data && data.players.length === 0 && (
        <p className="text-slate-600">Kriterlere uyan oyuncu bulunamadı.</p>
      )}

      {!loading && !error && data && data.players.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {data.players.map((player, i) => (
              <li key={player.id}>
                <Link
                  href={`/players/${player.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400 transition"
                >
                  <span className="w-6 text-center text-sm font-bold text-slate-400 tabular-nums">
                    {sortBy === 'level' ? player.rank ?? '–' : offset + i + 1}
                  </span>
                  <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} sizeClassName="w-11 h-11" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">
                      {player.name}
                      {player.recentBadges.length > 0 && (
                        <span className="ml-1.5 text-sm" title={`${player.badgeCount} rozet`}>
                          {player.recentBadges.join('')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {player.position ?? 'Pozisyon yok'} · {player.matchesPlayed} maç · {player.wins}G {player.losses}M
                      {player.mvpCount > 0 && ` · ⭐${player.mvpCount}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <LevelBadge level={player.rating} size="md" />
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {sortBy === 'winRate' ? `%${player.winRate.toFixed(0)}` : `${player.points} puan`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="text-sm font-semibold disabled:text-slate-300"
            >
              ← Önceki
            </button>
            <span className="text-sm text-slate-600">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, data.total)} / {data.total}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= data.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="text-sm font-semibold disabled:text-slate-300"
            >
              Sonraki →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
