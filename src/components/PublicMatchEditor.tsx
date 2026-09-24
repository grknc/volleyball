'use client';

import { useState } from 'react';
import { MatchResultContent } from '@/components/WeekView';
import { computeMatchResult, isCompletedMatch, type SetScore } from '@/lib/matchScoring';
import { MATCH_TARGET_POINTS } from '@/lib/constants';
import type { WeekViewData } from '@/lib/weekView';
import { formatLabel } from '@/lib/rating';

type MatchItem = WeekViewData['matches'][number];

function toResult(sets: SetScore[], targetPoints: number | null): MatchItem['result'] {
  const target = targetPoints ?? undefined;
  return isCompletedMatch({ sets }, target) ? computeMatchResult(sets, target) : null;
}

function ScoreEditForm({ match, onSaved }: { match: MatchItem; onSaved: (m: MatchItem) => void }) {
  const [sets, setSets] = useState<SetScore[]>(match.sets.length > 0 ? match.sets : [[0, 0], [0, 0]]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateSet(index: number, side: 0 | 1, value: number) {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? ([side === 0 ? value : s[0], side === 1 ? value : s[1]] as SetScore) : s)),
    );
  }

  function addSet() {
    if (sets.length < 3) setSets((prev) => [...prev, [0, 0]]);
  }

  async function patchSets(newSets: SetScore[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/matches/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets: newSets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Skor kaydedilemedi');
        return;
      }
      onSaved({ ...match, sets: data.match.sets, result: toResult(data.match.sets, match.targetPoints) });
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
    <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2">
      {match.targetPoints && <p className="text-xs text-slate-500">Bu maç {match.targetPoints} sayıya oynanıyor</p>}
      <div className="flex flex-wrap gap-2">
        {sets.map((set, index) => (
          <div key={index} className="flex gap-1 items-center">
            <input
              type="number"
              min={0}
              value={set[0]}
              onChange={(e) => updateSet(index, 0, Number(e.target.value))}
              className="border rounded w-12 px-1 text-sm"
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              value={set[1]}
              onChange={(e) => updateSet(index, 1, Number(e.target.value))}
              className="border rounded w-12 px-1 text-sm"
            />
          </div>
        ))}
        {sets.length < 3 && (
          <button onClick={addSet} className="text-xs underline">
            + Set
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="bg-emerald-700 text-white rounded px-3 py-1 w-fit text-sm disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Skoru Kaydet'}
        </button>
        {match.sets.length > 0 && (
          <button
            onClick={clearScore}
            disabled={saving}
            className="text-red-600 border border-red-200 rounded px-3 py-1 w-fit text-sm disabled:opacity-50"
          >
            Skoru Sil
          </button>
        )}
      </div>
    </div>
  );
}

function AddMatchForm({
  week,
  onAdded,
}: {
  week: WeekViewData;
  onAdded: (m: MatchItem) => void;
}) {
  const [teamAId, setTeamAId] = useState(week.teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState(week.teams[1]?.id ?? '');
  const [targetPoints, setTargetPoints] = useState<number>(MATCH_TARGET_POINTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addMatch() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/weeks/${week.id}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAId, teamBId, targetPoints }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Maç eklenemedi');
        return;
      }
      onAdded({
        id: data.match.id,
        teamAId: data.match.teamAId,
        teamBId: data.match.teamBId,
        sets: [],
        targetPoints: data.match.targetPoints,
        format: formatLabel(
          week.teams.find((t) => t.id === data.match.teamAId)?.players.length ?? 0,
          week.teams.find((t) => t.id === data.match.teamBId)?.players.length ?? 0
        ),
        result: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 items-end">
      <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className="border rounded px-2 py-1 text-sm">
        {week.teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <span className="text-sm text-slate-500">vs</span>
      <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="border rounded px-2 py-1 text-sm">
        {week.teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select
        value={targetPoints}
        onChange={(e) => setTargetPoints(Number(e.target.value))}
        className="border rounded px-2 py-1 text-sm"
      >
        {MATCH_TARGET_POINTS.map((points) => (
          <option key={points} value={points}>{points} sayı</option>
        ))}
      </select>
      <button
        onClick={addMatch}
        disabled={saving || teamAId === teamBId}
        className="bg-slate-900 text-white rounded px-3 py-1 text-sm disabled:opacity-50"
      >
        Maç Ekle
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </div>
  );
}

export function PublicMatchEditor({ week }: { week: WeekViewData }) {
  const [matches, setMatches] = useState<MatchItem[]>(week.matches);

  function handleSaved(updated: MatchItem) {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  function handleAdded(added: MatchItem) {
    setMatches((prev) => [...prev, added]);
  }

  const weekForDisplay: WeekViewData = { ...week, matches };

  return (
    <div>
      {matches.length === 0 ? (
        <p className="text-slate-500">Henüz maç planlanmadı.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => (
            <li key={match.id} className="border border-slate-200 rounded-lg p-3">
              <MatchResultContent match={match} week={weekForDisplay} />
              <ScoreEditForm match={match} onSaved={handleSaved} />
            </li>
          ))}
        </ul>
      )}
      {week.teams.length >= 2 ? (
        <AddMatchForm week={week} onAdded={handleAdded} />
      ) : (
        <p className="text-slate-500 text-sm mt-4">Maç eklemek için önce takım oluşturulmalı.</p>
      )}
    </div>
  );
}
