'use client';

import { useState } from 'react';

interface TeamOption {
  id: string;
  name: string;
}

interface MatchItem {
  id: string;
  teamAId: string;
  teamBId: string;
  sets: [number, number][];
}

interface Props {
  weekId: string;
  teams: TeamOption[];
  initialMatches: MatchItem[];
}

export function FixtureManager({ weekId, teams, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id;
  }

  async function addMatch() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAId, teamBId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Maç eklenemedi');
      return;
    }
    setMatches((prev) => [...prev, data.match]);
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Fikstür</h2>
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
        <button onClick={addMatch} className="bg-slate-900 text-white rounded px-3 py-1">
          Maç Ekle
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li key={match.id} className="border rounded p-2 flex justify-between items-center">
            <span>{teamName(match.teamAId)} - {teamName(match.teamBId)}</span>
            <span className="text-slate-500 text-sm">Henüz oynanmadı</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
