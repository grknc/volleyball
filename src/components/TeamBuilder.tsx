'use client';

import { useMemo, useState } from 'react';
import { LevelBadge } from '@/components/LevelBadge';
import { formatLevel } from '@/lib/rating';
import { suggestFormats, summarizeTeam } from '@/lib/teamBalancer';

interface AttendeePlayer {
  id: string;
  name: string;
  /** Dinamik seviye */
  level: number;
  position: string | null;
}

interface TeamWithPlayers {
  id?: string;
  name: string;
  players: { player: { id: string } }[];
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

const POSITION_SHORT: Record<string, string> = {
  Pasör: 'P',
  'Orta Oyuncu': 'O',
  Libero: 'L',
  Smaçör: 'S',
  Çaprazcı: 'Ç',
};

function toDraft(teams: TeamWithPlayers[]): DraftTeam[] {
  return teams.map((t) => ({ name: t.name, playerIds: t.players.map((p) => p.player.id) }));
}

export function TeamBuilder({ weekId, attendees, initialTeams }: Props) {
  const formats = suggestFormats(attendees.length);
  const [teamCount, setTeamCount] = useState(formats[0]?.teamCount ?? 2);
  const [draft, setDraft] = useState<DraftTeam[]>(toDraft(initialTeams));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(attendees.map((a) => [a.id, a])), [attendees]);
  const assigned = new Set(draft.flatMap((t) => t.playerIds));
  const unassigned = attendees.filter((a) => !assigned.has(a.id));

  async function suggest(variation = 0) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/weeks/${weekId}/teams/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCount, variation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Öneri alınamadı');
        return;
      }
      setDraft(
        data.teams.map((t: { name: string; players: { id: string }[] }) => ({
          name: t.name,
          playerIds: t.players.map((p) => p.id),
        }))
      );
      setInfo('Öneri hazır — beğendiysen “Kaydet”e bas.');
    } finally {
      setBusy(false);
    }
  }

  function moveToTeam(playerId: string, targetIndex: number) {
    setDraft((prev) =>
      prev.map((team, index) => {
        if (index === targetIndex) {
          return team.playerIds.includes(playerId) ? team : { ...team, playerIds: [...team.playerIds, playerId] };
        }
        return { ...team, playerIds: team.playerIds.filter((id) => id !== playerId) };
      })
    );
  }

  function removeFromTeams(playerId: string) {
    setDraft((prev) => prev.map((team) => ({ ...team, playerIds: team.playerIds.filter((id) => id !== playerId) })));
  }

  function renameTeam(index: number, name: string) {
    setDraft((prev) => prev.map((team, i) => (i === index ? { ...team, name } : team)));
  }

  async function save() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
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
      setInfo('Takımlar kaydedildi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Takımlar</h2>

      {formats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
          <span className="text-slate-500">{attendees.length} kişi için öneri:</span>
          {formats.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setTeamCount(f.teamCount)}
              className={`rounded-md px-2 py-1 font-semibold border ${
                teamCount === f.teamCount ? 'bg-blue-700 text-white border-blue-700' : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end mb-2">
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
        <button onClick={() => suggest(0)} disabled={busy} className="bg-slate-900 text-white rounded px-3 py-1 disabled:opacity-50">
          Takımları Öner
        </button>
        <button
          onClick={() => suggest(1.2)}
          disabled={busy}
          className="border border-slate-400 rounded px-3 py-1 disabled:opacity-50"
          title="Benzer dengede farklı bir dağılım dener"
        >
          🔀 Başka Öner
        </button>
        <button onClick={save} disabled={busy} className="bg-emerald-700 text-white rounded px-3 py-1 disabled:opacity-50">
          Kaydet
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Öneri, pasör / orta oyuncu / liberoyu takımlara eşit dağıtır ve güncel seviyelere göre dengeler.
      </p>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {info && <p className="text-emerald-700 text-sm mb-2">{info}</p>}

      {unassigned.length > 0 && draft.length > 0 && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900 mb-2">Takımsız katılımcılar ({unassigned.length})</p>
          <ul className="flex flex-col gap-1">
            {unassigned.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {p.name} <span className="text-xs text-slate-500">{p.position ?? ''}</span>{' '}
                  <LevelBadge level={p.level} size="xs" />
                </span>
                <select
                  value=""
                  onChange={(e) => e.target.value !== '' && moveToTeam(p.id, Number(e.target.value))}
                  className="border rounded text-sm"
                >
                  <option value="">Takıma ekle…</option>
                  {draft.map((t, i) => (
                    <option key={i} value={i}>
                      {t.name || `Takım ${i + 1}`}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {draft.map((team, index) => {
          const members = team.playerIds.map((id) => byId.get(id)).filter((p): p is AttendeePlayer => Boolean(p));
          const summary = summarizeTeam(members);
          return (
            <div key={index} className="border rounded p-3 bg-white">
              <input
                value={team.name}
                onChange={(e) => renameTeam(index, e.target.value)}
                className="font-semibold border-b w-full mb-2"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-2">
                <span>
                  {summary.size} kişi · ort. <strong>{formatLevel(summary.levelAvg)}</strong> · toplam{' '}
                  {formatLevel(summary.levelSum)}
                </span>
                <span className="text-slate-400">|</span>
                <span>
                  P {summary.roles['Pasör']} · O {summary.roles['Orta Oyuncu']} · L {summary.roles['Libero']} · Hücum{' '}
                  {summary.roles['Hücum']}
                </span>
              </div>
              {summary.warnings.length > 0 && (
                <p className="text-xs text-amber-700 mb-2">⚠️ {summary.warnings.join(' · ')}</p>
              )}
              <ul className="flex flex-col gap-1">
                {team.playerIds.map((id) => {
                  const p = byId.get(id);
                  return (
                    <li key={id} className="flex justify-between items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className="w-5 text-center text-[10px] font-bold rounded bg-slate-100 text-slate-600">
                          {p?.position ? POSITION_SHORT[p.position] ?? '?' : '–'}
                        </span>
                        {p?.name ?? 'Katılımcı değil'}
                        {p && <LevelBadge level={p.level} size="xs" />}
                      </span>
                      <span className="flex gap-1">
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
                        <button
                          type="button"
                          onClick={() => removeFromTeams(id)}
                          className="text-xs text-slate-500 px-1"
                          aria-label="Takımdan çıkar"
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
