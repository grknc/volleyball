'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function AdminGameDeleteButton({ gameId, venue, date }: { gameId: string; venue: string; date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Silme başarısız');
        return;
      }
      router.refresh();
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-red-600 underline">
        Sil
      </button>
      {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      <ConfirmDialog
        open={open}
        title="Oyunu kalıcı olarak sil"
        details={[
          { label: 'Saha', value: venue },
          { label: 'Tarih', value: date },
        ]}
        warning="Oyun ve tüm katılımcıları silinir. Bu işlem geri alınamaz."
        confirmLabel={busy ? 'Siliniyor…' : 'Kalıcı Olarak Sil'}
        danger
        disabled={busy}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
