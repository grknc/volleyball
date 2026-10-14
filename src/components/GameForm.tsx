'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CAPACITY_MAX, CAPACITY_MIN } from '@/lib/capacity';
import { saveManageToken } from '@/lib/gameStorage';

export interface GameFormValues {
  venue: string;
  date: string;
  time: string;
  capacity: string;
  totalCost: string;
  organizerFree: boolean;
  organizerName: string;
  organizerContact: string;
  paymentNote: string;
}

const EMPTY: GameFormValues = {
  venue: '',
  date: '',
  time: '19:00',
  capacity: '12',
  totalCost: '',
  organizerFree: false,
  organizerName: '',
  organizerContact: '',
  paymentNote: '',
};

interface GameFormProps {
  /** Verilirse düzenleme, verilmezse oluşturma. */
  gameId?: string;
  manageToken?: string;
  initial?: GameFormValues;
}

const INPUT = 'border rounded px-2 py-1.5 w-full';

export function GameForm({ gameId, manageToken, initial }: GameFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<GameFormValues>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isEdit = gameId !== undefined;

  function set<K extends keyof GameFormValues>(key: K, value: GameFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const game = { ...values, capacity: Number(values.capacity) };
    try {
      const res = isEdit
        ? await fetch(`/api/games/${gameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-manage-token': manageToken ?? '' },
            body: JSON.stringify({ game }),
          })
        : await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (isEdit ? 'Oyun güncellenemedi' : 'Oyun oluşturulamadı'));
        return;
      }
      if (isEdit) {
        setSaved(true);
        router.refresh();
      } else {
        saveManageToken(data.id, data.manageToken);
        router.push(`/oyunlar/${data.id}`);
      }
    } catch {
      setError('Bağlantı hatası. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div>
        <label htmlFor="game-venue" className="block text-sm mb-1">Saha</label>
        <input
          id="game-venue"
          value={values.venue}
          onChange={(e) => set('venue', e.target.value)}
          placeholder="Salon adı ve adresi"
          maxLength={120}
          required
          className={INPUT}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="game-date" className="block text-sm mb-1">Tarih</label>
          <input
            id="game-date"
            type="date"
            value={values.date}
            onChange={(e) => set('date', e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="game-time" className="block text-sm mb-1">Saat</label>
          <input
            id="game-time"
            type="time"
            value={values.time}
            onChange={(e) => set('time', e.target.value)}
            required
            className={INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Saat Almanya saatine göredir.</p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="game-capacity" className="block text-sm mb-1">Oyuncu sayısı</label>
          <input
            id="game-capacity"
            type="number"
            min={CAPACITY_MIN}
            max={CAPACITY_MAX}
            step={1}
            value={values.capacity}
            onChange={(e) => set('capacity', e.target.value)}
            required
            className={INPUT}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="game-cost" className="block text-sm mb-1">Toplam saha bedeli (€)</label>
          <input
            id="game-cost"
            inputMode="decimal"
            value={values.totalCost}
            onChange={(e) => set('totalCost', e.target.value)}
            placeholder="60"
            required
            className={INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Kişi başı ücret, katılan oyuncu sayısına göre otomatik hesaplanır. Ücretsizse 0 yazın.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={values.organizerFree}
          onChange={(e) => set('organizerFree', e.target.checked)}
          className="mt-1"
        />
        <span>Organizatör ücret ödemez (saha bedeli diğer oyuncular arasında bölünür)</span>
      </label>

      <div>
        <label htmlFor="game-organizer" className="block text-sm mb-1">Adınız</label>
        <input
          id="game-organizer"
          value={values.organizerName}
          onChange={(e) => set('organizerName', e.target.value)}
          maxLength={40}
          required
          className={INPUT}
        />
        <p className="text-xs text-slate-500 mt-1">Organizatör olarak ilk oyuncu siz olursunuz.</p>
      </div>

      <div>
        <label htmlFor="game-contact" className="block text-sm mb-1">İletişim</label>
        <input
          id="game-contact"
          value={values.organizerContact}
          onChange={(e) => set('organizerContact', e.target.value)}
          placeholder="Telefon, WhatsApp, e-posta…"
          maxLength={120}
          required
          className={INPUT}
        />
        <p className="text-xs text-slate-500 mt-1">Bu bilgi oyunu gören herkese açıktır.</p>
      </div>

      <div>
        <label htmlFor="game-payment" className="block text-sm mb-1">Ödeme notu (isteğe bağlı)</label>
        <textarea
          id="game-payment"
          value={values.paymentNote}
          onChange={(e) => set('paymentNote', e.target.value)}
          placeholder="PayPal adresi veya IBAN"
          maxLength={300}
          rows={2}
          className={INPUT}
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Kaydedildi.</p>}

      <button
        type="submit"
        disabled={busy}
        className="self-start bg-blue-700 text-white rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {busy ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri Kaydet' : 'Oyunu Oluştur'}
      </button>
    </form>
  );
}
