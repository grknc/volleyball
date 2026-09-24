'use client';

import { useEffect, useState } from 'react';
import { PLAYER_POSITIONS } from '@/lib/constants';

interface Player {
  id: string;
  name: string;
  level: number;
  position: string | null;
  heightCm: number | null;
  avatarUrl: string | null;
  notes: string | null;
  isActive: boolean;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(5);
  const [position, setPosition] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notes, setNotes] = useState('');
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
      body: JSON.stringify({
        name,
        level,
        position: position || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        avatarUrl: avatarUrl || undefined,
        notes: notes || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Oyuncu eklenemedi');
      return;
    }
    setName('');
    setLevel(5);
    setPosition('');
    setHeightCm('');
    setAvatarUrl('');
    setNotes('');
    loadPlayers();
  }

  async function patchPlayer(player: Player, patch: Record<string, unknown>) {
    await fetch(`/api/admin/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    loadPlayers();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Oyuncular</h1>
      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-6 items-end">
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
          <label className="block text-sm">Başlangıç Seviyesi (1-10)</label>
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
        <div>
          <label className="block text-sm">Pozisyon</label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Seçilmedi</option>
            {PLAYER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm">Boy (cm)</label>
          <input
            type="number"
            min={100}
            max={250}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="border rounded px-2 py-1 w-20"
          />
        </div>
        <div>
          <label className="block text-sm">Profil Fotoğrafı URL</label>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-sm">Not</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-2 py-1" />
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
            <th className="py-2">Başl. Seviye</th>
            <th className="py-2">Pozisyon</th>
            <th className="py-2">Boy</th>
            <th className="py-2">Foto URL</th>
            <th className="py-2">Not</th>
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
                  onBlur={(e) => patchPlayer(player, { level: Number(e.target.value) })}
                  className="border rounded px-2 py-1 w-16"
                />
              </td>
              <td className="py-2">
                <select
                  defaultValue={player.position ?? ''}
                  onChange={(e) => patchPlayer(player, { position: e.target.value || null })}
                  className="border rounded px-2 py-1"
                >
                  <option value="">Seçilmedi</option>
                  {PLAYER_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={100}
                  max={250}
                  defaultValue={player.heightCm ?? ''}
                  onBlur={(e) =>
                    patchPlayer(player, { heightCm: e.target.value ? Number(e.target.value) : null })
                  }
                  className="border rounded px-2 py-1 w-20"
                />
              </td>
              <td className="py-2">
                <input
                  defaultValue={player.avatarUrl ?? ''}
                  onBlur={(e) => patchPlayer(player, { avatarUrl: e.target.value || null })}
                  className="border rounded px-2 py-1 w-40"
                />
              </td>
              <td className="py-2">
                <input
                  defaultValue={player.notes ?? ''}
                  onBlur={(e) => patchPlayer(player, { notes: e.target.value || null })}
                  className="border rounded px-2 py-1 w-40"
                />
              </td>
              <td className="py-2">{player.isActive ? 'Aktif' : 'Pasif'}</td>
              <td className="py-2">
                <button
                  onClick={() => patchPlayer(player, { isActive: !player.isActive })}
                  className="text-sm underline"
                >
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
