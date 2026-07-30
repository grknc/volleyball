'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
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
  { value: 'name', label: 'Alfabetik' },
  { value: 'matches', label: 'En Çok Maç Oynayan' },
  { value: 'wins', label: 'En Çok Kazanan' },
  { value: 'winRate', label: 'En Yüksek Kazanma Oranı' },
  { value: 'mvps', label: 'En Fazla Haftanın Oyuncusu' },
] as const;

export default function PlayersPage() {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [skillLevel, setSkillLevel] = useState('');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PlayersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [search, position, skillLevel, sortBy, order]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (position) params.set('position', position);
    if (skillLevel) params.set('skillLevel', skillLevel);
    params.set('sortBy', sortBy);
    params.set('order', order);
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
  }, [search, position, skillLevel, sortBy, order, offset]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Oyuncular</h1>

      <div className="flex flex-wrap gap-2 mb-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İsme göre ara"
          aria-label="Oyuncu ara"
          className="border rounded px-2 py-1 flex-1 min-w-[160px]"
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          aria-label="Pozisyona göre filtrele"
          className="border rounded px-2 py-1"
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
          className="border rounded px-2 py-1"
        >
          <option value="">Tüm Seviyeler</option>
          {SKILL_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              Seviye {lvl}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]['value'])}
          aria-label="Sıralama"
          className="border rounded px-2 py-1"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}
          aria-label="Sıralama yönü"
          className="border rounded px-2 py-1"
        >
          <option value="asc">Artan</option>
          <option value="desc">Azalan</option>
        </select>
      </div>

      {sortBy === 'winRate' && data && (
        <p className="text-sm text-slate-600 mb-4">
          En az {data.minMatchesForWinRate} maç oynamış oyuncular arasında sıralanıyor.
        </p>
      )}

      {loading && (
        <div className="space-y-2" role="status" aria-label="Yükleniyor">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && data && data.players.length === 0 && (
        <p className="text-slate-600">Kriterlere uyan oyuncu bulunamadı.</p>
      )}

      {!loading && !error && data && data.players.length > 0 && (
        <>
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="border-b">
                <th className="py-2">Oyuncu</th>
                <th className="py-2">Pozisyon</th>
                <th className="py-2">Seviye</th>
                <th className="py-2">Hafta</th>
                <th className="py-2">Maç</th>
                <th className="py-2">G/M</th>
                <th className="py-2">Kazanma %</th>
                <th className="py-2">MVP</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player) => (
                <tr key={player.id} className="border-b">
                  <td className="py-2">
                    <Link href={`/players/${player.id}`} className="flex items-center gap-2 underline">
                      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} sizeClassName="w-8 h-8" />
                      {player.name}
                    </Link>
                  </td>
                  <td className="py-2">{player.position ?? '-'}</td>
                  <td className="py-2">{player.level}</td>
                  <td className="py-2">{player.weeksPlayed}</td>
                  <td className="py-2">{player.matchesPlayed}</td>
                  <td className="py-2">
                    {player.wins}/{player.losses}
                  </td>
                  <td className="py-2">%{player.winRate.toFixed(0)}</td>
                  <td className="py-2">{player.mvpCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden space-y-3">
            {data.players.map((player) => (
              <Link key={player.id} href={`/players/${player.id}`} className="block border rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} />
                  <span className="font-semibold">{player.name}</span>
                </div>
                <p className="text-sm text-slate-600">
                  {player.position ?? 'Pozisyon belirtilmemiş'} · Seviye {player.level}
                </p>
                <p className="text-sm">
                  {player.matchesPlayed} maç · {player.wins}G {player.losses}M · %
                  {player.winRate.toFixed(0)} · {player.mvpCount} MVP
                </p>
              </Link>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="text-sm underline disabled:text-slate-400 disabled:no-underline"
            >
              Önceki
            </button>
            <span className="text-sm text-slate-600">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, data.total)} / {data.total}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= data.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="text-sm underline disabled:text-slate-400 disabled:no-underline"
            >
              Sonraki
            </button>
          </div>
        </>
      )}
    </main>
  );
}
