'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAPACITY_MAX, CAPACITY_MIN, CAPACITY_PRESETS, capacityLabel } from '@/lib/capacity';

interface Player {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
}

export default function NewWeekPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [capacity, setCapacity] = useState<string>('12');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/players')
      .then((res) => res.json())
      .then((data) => setPlayers(data.players.filter((p: Player) => p.isActive)));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        attendeePlayerIds: Array.from(selected),
        capacity: capacity === '' ? null : Number(capacity),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Hafta oluşturulamadı');
      return;
    }
    router.push(`/admin/haftalar/${data.week.id}`);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Yeni Hafta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Kontenjan</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CAPACITY_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCapacity(String(c))}
                className={`text-xs rounded-md px-2 py-1 border ${
                  capacity === String(c) ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-slate-300'
                }`}
              >
                {capacityLabel(c)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCapacity('')}
              className={`text-xs rounded-md px-2 py-1 border ${
                capacity === '' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-slate-300'
              }`}
            >
              Sınırsız
            </button>
          </div>
          <input
            type="number"
            min={CAPACITY_MIN}
            max={CAPACITY_MAX}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Sınırsız"
            className="border rounded px-2 py-1 w-28"
          />
          <p className="text-xs text-slate-500 mt-1">Kontenjan dolunca yeni katılımcılar sırayla yedek listesine yazılır.</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Katılımcılar (opsiyonel)</label>
          <p className="text-xs text-slate-500 mb-1">
            Boş bırakabilirsin: haftayı “Yayında” yapınca oyuncular ana sayfadan “Geliyorum / Gelmiyorum” diyebilir.
          </p>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border rounded p-2">
            {players.map((player) => (
              <label key={player.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
                {player.name} (Seviye {player.level})
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-2">
          Haftayı Oluştur
        </button>
      </form>
    </div>
  );
}
