'use client';

import { useState } from 'react';

interface AttendeePlayer {
  id: string;
  name: string;
  level: number;
}

interface TeamWithPlayers {
  id?: string;
  name: string;
  players: { player: AttendeePlayer }[];
}

interface Props {
  weekId: string;
  attendees: AttendeePlayer[];
  initialTeams: TeamWithPlayers[];
}

interface DraftTeam {
  name: string;
  playerIds: string[];
}

function toDraft(teams: TeamWithPlayers[]): DraftTeam[] {
  return teams.map((t) => ({ name: t.name, playerIds: t.players.map((p) => p.player.id) }));
}

export function TeamBuilder({ weekId, attendees, initialTeams }: Props) {
  const [teamCount, setTeamCount] = useState(2);
  const [draft, setDraft] = useState<DraftTeam[]>(toDraft(initialTeams));
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/teams/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Öneri alınamadı');
      return;
    }
    setDraft(
      data.teams.map((t: { name: string; players: AttendeePlayer[] }) => ({
        name: t.name,
        playerIds: t.players.map((p) => p.id),
      })),
    );
  }

  function playerName(id: string) {
    return attendees.find((a) => a.id === id)?.name ?? id;
  }

  function moveToTeam(playerId: string, targetIndex: number) {
    setDraft((prev) =>
      prev.map((team, index) => {
        if (index === targetIndex) {
          return team.playerIds.includes(playerId) ? team : { ...team, playerIds: [...team.playerIds, playerId] };
        }
        return { ...team, playerIds: team.playerIds.filter((id) => id !== playerId) };
      }),
    );
  }

  function renameTeam(index: number, name: string) {
    setDraft((prev) => prev.map((team, i) => (i === index ? { ...team, name } : team)));
  }

  async function save() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: draft }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Takımlar kaydedilemedi');
      return;
    }
    setDraft(toDraft(data.teams));
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Takımlar</h2>
      <div className="flex gap-2 items-end mb-4">
        <div>
          <label className="block text-sm">Takım sayısı</label>
          <input
            type="number"
            min={2}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20"
          />
        </div>
        <button onClick={suggest} className="bg-slate-900 text-white rounded px-3 py-1">
          Takımları Öner
        </button>
        <button onClick={save} className="bg-emerald-700 text-white rounded px-3 py-1">
          Kaydet
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {draft.map((team, index) => (
          <div key={index} className="border rounded p-3">
            <input
              value={team.name}
              onChange={(e) => renameTeam(index, e.target.value)}
              className="font-semibold border-b w-full mb-2"
            />
            <ul className="flex flex-col gap-1">
              {team.playerIds.map((id) => (
                <li key={id} className="flex justify-between items-center">
                  <span>{playerName(id)}</span>
                  <select
                    value={index}
                    onChange={(e) => moveToTeam(id, Number(e.target.value))}
                    className="border rounded text-sm"
                  >
                    {draft.map((_, i) => (
                      <option key={i} value={i}>
                        {draft[i].name || `Takım ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
