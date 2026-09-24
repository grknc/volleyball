'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PublicNav } from '@/components/PublicNav';

interface OverviewStats {
  totalPlayers: number;
  totalWeeks: number;
  totalMatches: number;
  totalSets: number;
  averageWeeklyAttendance: number;
  mostAttendedWeek: { weekId: string; weekDate: string; attendeeCount: number } | null;
}

interface LeaderboardEntry {
  playerId: string;
  name: string;
  value: number;
}

interface PlayerLeaderboards {
  minMatchesForWinRate: number;
  mostMatches: LeaderboardEntry[];
  mostWins: LeaderboardEntry[];
  highestWinRate: LeaderboardEntry[];
  mostMvps: LeaderboardEntry[];
  mostWeeksPlayed: LeaderboardEntry[];
  mostSetsWon: LeaderboardEntry[];
  bestSetDiff: LeaderboardEntry[];
  highestLevel: LeaderboardEntry[];
  mostPoints: LeaderboardEntry[];
}

interface MatchRecordSummary {
  matchId: string;
  weekDate: string;
  teamAName: string;
  teamBName: string;
}

interface TeamMatchRecords {
  biggestBlowout: MatchRecordSummary | null;
  closestMatch: MatchRecordSummary | null;
  highestScoringMatch: MatchRecordSummary | null;
}

type Scope = 'all' | 'last10';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function StatisticsPage() {
  const [scope, setScope] = useState<Scope>('all');
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [leaderboards, setLeaderboards] = useState<PlayerLeaderboards | null>(null);
  const [teamRecords, setTeamRecords] = useState<TeamMatchRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = `scope=${scope}`;
    Promise.all([
      fetch(`/api/statistics/overview?${qs}`).then((r) => r.json()),
      fetch(`/api/statistics/players?${qs}`).then((r) => r.json()),
      fetch(`/api/statistics/teams?${qs}`).then((r) => r.json()),
    ])
      .then(([o, p, t]) => {
        setOverview(o);
        setLeaderboards(p);
        setTeamRecords(t);
      })
      .catch(() => setError('İstatistikler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [scope]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <PublicNav />
      <h1 className="text-xl font-bold mb-4">İstatistikler</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setScope('all')}
          aria-pressed={scope === 'all'}
          className={`text-sm px-3 py-1 rounded border ${scope === 'all' ? 'bg-slate-900 text-white' : ''}`}
        >
          Tüm Zamanlar
        </button>
        <button
          onClick={() => setScope('last10')}
          aria-pressed={scope === 'last10'}
          className={`text-sm px-3 py-1 rounded border ${scope === 'last10' ? 'bg-slate-900 text-white' : ''}`}
        >
          Son 10 Hafta
        </button>
      </div>

      {loading && (
        <div className="space-y-2" role="status" aria-label="Yükleniyor">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && overview && (
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Card label="Toplam Oyuncu" value={overview.totalPlayers} />
          <Card label="Toplam Hafta" value={overview.totalWeeks} />
          <Card label="Toplam Maç" value={overview.totalMatches} />
          <Card label="Toplam Set" value={overview.totalSets} />
          <Card label="Ortalama Haftalık Katılımcı" value={overview.averageWeeklyAttendance.toFixed(1)} />
          <Card
            label="En Yüksek Katılımlı Hafta"
            value={overview.mostAttendedWeek ? overview.mostAttendedWeek.attendeeCount : '-'}
          />
        </section>
      )}

      {!loading && !error && leaderboards && (
        <section className="space-y-6 mb-6">
          <Leaderboard
            title="En Yüksek Seviye"
            entries={leaderboards.highestLevel}
            sortBy="level"
            note="Güncel seviye (tüm zamanlar)"
            decimals={2}
          />
          <Leaderboard title="En Çok Puan" entries={leaderboards.mostPoints} sortBy="points" />
          <Leaderboard title="En Çok Maç Oynayan" entries={leaderboards.mostMatches} sortBy="matches" />
          <Leaderboard title="En Çok Galibiyet Alan" entries={leaderboards.mostWins} sortBy="wins" />
          <Leaderboard
            title="En Yüksek Kazanma Oranı"
            entries={leaderboards.highestWinRate}
            sortBy="winRate"
            note={`En az ${leaderboards.minMatchesForWinRate} maç oynamış oyuncular arasında`}
            suffix="%"
          />
          <Leaderboard title="En Çok Haftanın Oyuncusu" entries={leaderboards.mostMvps} sortBy="mvps" />
          <Leaderboard title="En Fazla Hafta Katılımı" entries={leaderboards.mostWeeksPlayed} sortBy="matches" />
          <Leaderboard title="En Fazla Set Kazanan" entries={leaderboards.mostSetsWon} sortBy="matches" />
          <Leaderboard title="En İyi Set Averajı" entries={leaderboards.bestSetDiff} sortBy="matches" />
        </section>
      )}

      {!loading && !error && teamRecords && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold mb-2">Maç Rekorları</h2>
          <MatchRecordRow label="En Farklı Biten Maç" record={teamRecords.biggestBlowout} />
          <MatchRecordRow label="En Yakın Biten Maç" record={teamRecords.closestMatch} />
          <MatchRecordRow label="En Yüksek Skorlu Maç" record={teamRecords.highestScoringMatch} />
        </section>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Leaderboard({
  title,
  entries,
  sortBy,
  note,
  suffix = '',
  decimals = 0,
}: {
  title: string;
  entries: LeaderboardEntry[];
  sortBy: string;
  note?: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={`/players?sortBy=${sortBy}&order=desc`} className="text-sm underline">
          Tümünü Gör
        </Link>
      </div>
      {note && <p className="text-xs text-slate-600 mb-1">{note}</p>}
      {entries.length === 0 ? (
        <p className="text-slate-600 text-sm">Henüz veri yok.</p>
      ) : (
        <ol className="text-sm space-y-1">
          {entries.slice(0, 5).map((e, i) => (
            <li key={e.playerId} className="flex justify-between">
              <span>
                {MEDALS[i] ?? `${i + 1}.`} {e.name}
              </span>
              <span>
                {e.value.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                {suffix}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MatchRecordRow({ label, record }: { label: string; record: MatchRecordSummary | null }) {
  if (!record) {
    return <p className="text-sm text-slate-600">{label}: henüz veri yok.</p>;
  }
  return (
    <p className="text-sm">
      <span className="font-medium">{label}:</span> {record.teamAName} - {record.teamBName} (
      {new Date(record.weekDate).toLocaleDateString('tr-TR')})
    </p>
  );
}
