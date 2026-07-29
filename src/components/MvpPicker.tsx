'use client';

import { useState } from 'react';

interface AttendeePlayer {
  id: string;
  name: string;
}

interface Props {
  weekId: string;
  attendees: AttendeePlayer[];
  initialMvpPlayerIds: string[];
}

export function MvpPicker({ weekId, attendees, initialMvpPlayerIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialMvpPlayerIds));
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    await fetch(`/api/admin/weeks/${weekId}/mvps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: Array.from(selected) }),
    });
    setSaved(true);
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Haftanın Oyuncusu</h2>
      <div className="flex flex-col gap-1 max-w-sm">
        {attendees.map((player) => (
          <label key={player.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
            {player.name}
          </label>
        ))}
      </div>
      <button onClick={save} className="bg-emerald-700 text-white rounded px-3 py-1 mt-2">
        Kaydet
      </button>
      {saved && <span className="text-emerald-700 text-sm ml-2">Kaydedildi</span>}
    </section>
  );
}
