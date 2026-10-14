'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { GameForm, type GameFormValues } from '@/components/GameForm';
import { GameStatusBadge } from '@/components/GameCard';
import { saveManageToken } from '@/lib/gameStorage';
import { GAME_STATUS_LABELS, type GameParticipantView, type GameStatus, type GameView } from '@/lib/games';

interface GameManagePanelProps {
  game: GameView;
  manageToken: string;
  initial: GameFormValues;
}

export function GameManagePanel({ game, manageToken, initial }: GameManagePanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toRemove, setToRemove] = useState<GameParticipantView | null>(null);

  // Yönetim bağlantısı başka cihazda açıldıysa o cihaz da oyunu yönetebilsin.
  useEffect(() => {
    saveManageToken(game.id, manageToken);
  }, [game.id, manageToken]);

  async function send(url: string, init: RequestInit, fallbackError: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-manage-token': manageToken },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? fallbackError);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: GameStatus) {
    await send(
      `/api/games/${game.id}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      'Durum güncellenemedi'
    );
    setConfirmCancel(false);
  }

  async function removeParticipant() {
    if (!toRemove) return;
    await send(`/api/games/${game.id}/participants/${toRemove.id}`, { method: 'DELETE' }, 'Oyuncu çıkarılamadı');
    setToRemove(null);
  }

  const everyone = [...game.confirmed, ...game.waitlist];

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-semibold">Durum</h2>
          <GameStatusBadge status={game.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['searching', 'reserved'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(status)}
              disabled={busy || game.status === status}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {GAME_STATUS_LABELS[status]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={busy || game.status === 'cancelled'}
            className="rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Oyunu iptal et
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-2">
          Katılımcılar ({game.confirmed.length}/{game.capacity}
          {game.waitlist.length > 0 && ` + ${game.waitlist.length} yedek`})
        </h2>
        <ul className="text-sm divide-y divide-slate-100">
          {everyone.map((p, index) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="break-words">
                {p.name}
                <span className="text-xs text-slate-500">
                  {p.isOrganizer ? ' · organizatör' : index >= game.capacity ? ' · yedek' : ''}
                  {p.note && ` — ${p.note}`}
                </span>
              </span>
              {!p.isOrganizer && (
                <button
                  type="button"
                  onClick={() => setToRemove(p)}
                  disabled={busy}
                  className="text-red-600 underline disabled:opacity-50"
                >
                  Çıkar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold mb-3">Oyun bilgileri</h2>
        <GameForm gameId={game.id} manageToken={manageToken} initial={initial} />
      </section>

      <ConfirmDialog
        open={confirmCancel}
        title="Oyunu iptal et"
        warning="İptal edilen oyun listeden kalkar ve kimse katılamaz. Bağlantısı açılmaya devam eder."
        confirmLabel={busy ? 'İptal ediliyor…' : 'Oyunu İptal Et'}
        danger
        disabled={busy}
        onConfirm={() => setStatus('cancelled')}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={toRemove !== null}
        title="Oyuncuyu çıkar"
        details={toRemove ? [{ label: 'Oyuncu', value: toRemove.name }] : undefined}
        warning="Çıkarılan oyuncunun yerine sıradaki yedek geçer."
        confirmLabel={busy ? 'Çıkarılıyor…' : 'Çıkar'}
        danger
        disabled={busy}
        onConfirm={removeParticipant}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
