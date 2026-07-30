'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface WeekRowActionsProps {
  weekId: string;
  weekDate: string;
  attendeeCount: number;
  teamCount: number;
  matchCount: number;
  isArchived: boolean;
}

export function WeekRowActions({
  weekId,
  weekDate,
  attendeeCount,
  teamCount,
  matchCount,
  isArchived,
}: WeekRowActionsProps) {
  const router = useRouter();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    setBusy(false);
    setConfirmArchive(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Arşivleme başarısız');
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}`, { method: 'DELETE' });
    setBusy(false);
    setConfirmDelete(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? data.error ?? 'Silme başarısız');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {!isArchived && (
        <button type="button" onClick={() => setConfirmArchive(true)} className="text-sm underline">
          Arşivle
        </button>
      )}
      <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-600 underline">
        Sil
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}

      <ConfirmDialog
        open={confirmArchive}
        title="Haftayı arşivle"
        details={[{ label: 'Hafta', value: weekDate }]}
        warning="Arşivlenen hafta ana sayfada gösterilmez, ancak geçmiş haftalar listesinden ve doğrudan bağlantıdan erişilebilir kalır."
        confirmLabel={busy ? 'Arşivleniyor…' : 'Arşivle'}
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Haftayı kalıcı olarak sil"
        details={[
          { label: 'Hafta', value: weekDate },
          { label: 'Oyuncu', value: attendeeCount },
          { label: 'Takım', value: teamCount },
          { label: 'Maç', value: matchCount },
        ]}
        warning="Bu işlem geri alınamaz."
        confirmLabel={busy ? 'Siliniyor…' : 'Kalıcı Olarak Sil'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
