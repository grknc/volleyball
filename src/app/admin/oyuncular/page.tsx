'use client';

import { useEffect, useState } from 'react';

interface Player {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(5);
  const [error, setError] = useState<string | null>(null);

  async function loadPlayers() {
    const res = await fetch('/api/admin/players');
    const data = await res.json();
    setPlayers(data.players);
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, level }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Oyuncu eklenemedi');
      return;
    }
    setName('');
    setLevel(5);
    loadPlayers();
  }

  async function toggleActive(player: Player) {
    await fetch(`/api/admin/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !player.isActive }),
    });
    loadPlayers();
  }

  async function updateLevel(player: Player, newLevel: number) {
    await fetch(`/api/admin/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: newLevel }),
    });
    loadPlayers();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Oyuncular</h1>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6 items-end">
        <div>
          <label className="block text-sm">İsim</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Seviye (1-10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20"
            required
          />
        </div>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1">
          Ekle
        </button>
      </form>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="py-2">İsim</th>
            <th className="py-2">Seviye</th>
            <th className="py-2">Durum</th>
            <th className="py-2">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-b">
              <td className="py-2">{player.name}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={player.level}
                  onBlur={(e) => updateLevel(player, Number(e.target.value))}
                  className="border rounded px-2 py-1 w-16"
                />
              </td>
              <td className="py-2">{player.isActive ? 'Aktif' : 'Pasif'}</td>
              <td className="py-2">
                <button onClick={() => toggleActive(player)} className="text-sm underline">
                  {player.isActive ? 'Pasife al' : 'Aktif yap'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
