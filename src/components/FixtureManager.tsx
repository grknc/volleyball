'use client';

import { useState } from 'react';
import { computeMatchResult } from '@/lib/matchScoring';
import { MATCH_TARGET_POINTS } from '@/lib/constants';

interface TeamOption {
  id: string;
  name: string;
}

interface MatchItem {
  id: string;
  teamAId: string;
  teamBId: string;
  sets: [number, number][];
  targetPoints: number | null;
}

interface Props {
  weekId: string;
  teams: TeamOption[];
  initialMatches: MatchItem[];
}

function ScoreForm({ match, onSaved }: { match: MatchItem; onSaved: (m: MatchItem) => void }) {
  const [sets, setSets] = useState<[number, number][]>(
    match.sets.length > 0 ? match.sets : [[0, 0], [0, 0]],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateSet(index: number, side: 0 | 1, value: number) {
    setSets((prev) =>
      prev.map((s, i) =>
        i === index ? ([side === 0 ? value : s[0], side === 1 ? value : s[1]] as [number, number]) : s,
      ),
    );
  }

  function addSet() {
    if (sets.length < 3) setSets((prev) => [...prev, [0, 0]]);
  }

  async function patchSets(newSets: [number, number][]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: newSets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Skor kaydedilemedi');
        return;
      }
      onSaved(data.match);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setError(null);
    try {
      computeMatchResult(sets, match.targetPoints ?? undefined);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    await patchSets(sets);
  }

  async function clearScore() {
    setError(null);
    await patchSets([]);
    setSets([[0, 0], [0, 0]]);
  }

  return (
    <div className="flex flex-col gap-2">
      {match.targetPoints && <p className="text-xs text-slate-500">Bu maç {match.targetPoints} sayıya oynanıyor</p>}
      <div className="flex gap-2">
        {sets.map((set, index) => (
          <div key={index} className="flex gap-1 items-center">
            <input
              type="number"
              min={0}
              value={set[0]}
              onChange={(e) => updateSet(index, 0, Number(e.target.value))}
              className="border rounded w-14 px-1"
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              value={set[1]}
              onChange={(e) => updateSet(index, 1, Number(e.target.value))}
              className="border rounded w-14 px-1"
            />
          </div>
        ))}
        {sets.length < 3 && (
          <button onClick={addSet} className="text-sm underline">
            + Set
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="bg-emerald-700 text-white rounded px-3 py-1 w-fit disabled:opacity-50">
          Skoru Kaydet
        </button>
        {match.sets.length > 0 && (
          <button onClick={clearScore} disabled={saving} className="text-red-600 border border-red-200 rounded px-3 py-1 w-fit disabled:opacity-50">
            Skoru Sil
          </button>
        )}
      </div>
    </div>
  );
}

export function FixtureManager({ weekId, teams, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? '');
  const [targetPoints, setTargetPoints] = useState<number>(MATCH_TARGET_POINTS[0]);
  const [error, setError] = useState<string | null>(null);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id;
  }

  async function addMatch() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAId, teamBId, targetPoints }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Maç eklenemedi');
      return;
    }
    setMatches((prev) => [...prev, data.match]);
  }

  function handleSaved(updated: MatchItem) {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Fikstür & Sonuçlar</h2>
      <div className="flex gap-2 items-end mb-4">
        <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span>vs</span>
        <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={targetPoints}
          onChange={(e) => setTargetPoints(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {MATCH_TARGET_POINTS.map((points) => (
            <option key={points} value={points}>{points} sayı</option>
          ))}
        </select>
        <button onClick={addMatch} className="bg-slate-900 text-white rounded px-3 py-1">
          Maç Ekle
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="flex flex-col gap-4">
        {matches.map((match) => (
          <li key={match.id} className="border rounded p-3">
            <div className="font-medium mb-2">
              {teamName(match.teamAId)} - {teamName(match.teamBId)}
            </div>
            <ScoreForm match={match} onSaved={handleSaved} />
          </li>
        ))}
      </ul>
    </section>
  );
}
