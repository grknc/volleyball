'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearLeave, readLeave, saveLeave, type LeaveRecord } from '@/lib/gameStorage';
import { NOTE_MAX } from '@/lib/games';

interface GameJoinPanelProps {
  gameId: string;
  joinOpen: boolean;
  isFull: boolean;
  /** Kesin + yedek tüm katılımcıların id'leri */
  participantIds: string[];
}

export function GameJoinPanel({ gameId, joinOpen, isFull, participantIds }: GameJoinPanelProps) {
  const router = useRouter();
  const [mine, setMine] = useState<LeaveRecord | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bu tarayıcıdan katılınmış mı? Organizatör kişiyi çıkardıysa kayıt eskimiştir.
  useEffect(() => {
    const record = readLeave(gameId);
    if (record && !participantIds.includes(record.participantId)) {
      clearLeave(gameId);
      setMine(null);
    } else if (record) {
      setMine(record);
    }
  }, [gameId, participantIds]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/games/${gameId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Katılım başarısız');
        if (res.status === 409) router.refresh();
        return;
      }
      const record = { participantId: data.participantId, token: data.leaveToken };
      saveLeave(gameId, record);
      setMine(record);
      setName('');
      setNote('');
      setNotice(
        data.placement === 'waitlisted'
          ? `Kontenjan dolu, yedek listesindesiniz (${data.waitlistPosition}. sıra).`
          : 'Katıldınız!'
      );
      router.refresh();
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (busy || !mine) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/games/${gameId}/participants/${mine.participantId}`, {
        method: 'DELETE',
        headers: { 'x-leave-token': mine.token },
      });
      // 404: organizatör zaten çıkarmış — sonuç aynı.
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Ayrılma başarısız');
        return;
      }
      clearLeave(gameId);
      setMine(null);
      setNotice('Oyundan ayrıldınız.');
      router.refresh();
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      {mine ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">Bu oyuna katıldınız.</p>
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Ayrılınıyor…' : 'Ayrıl'}
          </button>
        </div>
      ) : joinOpen ? (
        <form onSubmit={handleJoin} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="join-name" className="block text-sm mb-1">Adınız</label>
            <input
              id="join-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              className="border rounded px-2 py-1.5 w-full"
            />
          </div>
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="join-note" className="block text-sm mb-1">Not (isteğe bağlı)</label>
            <input
              id="join-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Örn. orta seviye, pasör"
              maxLength={NOTE_MAX}
              className="border rounded px-2 py-1.5 w-full"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Kaydediliyor…' : isFull ? 'Yedek listesine katıl' : 'Katıl'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">Bu oyuna artık katılınamıyor.</p>
      )}
      {notice && <p className="text-sm text-green-700 mt-2">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
      {mine && (
        <p className="text-xs text-slate-500 mt-2">
          Yalnızca bu cihazdan ayrılabilirsiniz. Başka cihazdaysanız organizatöre yazın.
        </p>
      )}
    </section>
  );
}
