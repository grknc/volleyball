'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WEEK_STATUS_LABELS, type WeekStatus } from '@/lib/constants';

interface WeekResetControlProps {
  weekId: string;
  weekDateLabel: string;
  currentStatus: WeekStatus;
  teamCount: number;
  matchCount: number;
  setCount: number;
  mvpCount: number;
  attendeeCount: number;
}

export function WeekResetControl({
  weekId,
  weekDateLabel,
  currentStatus,
  teamCount,
  matchCount,
  setCount,
  mvpCount,
  attendeeCount,
}: WeekResetControlProps) {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [removeAttendees, setRemoveAttendees] = useState(false);
  const [resetStatus, setResetStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeAttendees, resetStatus }),
    });
    setBusy(false);
    setConfirmReset(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Sıfırlama başarısız');
      return;
    }
    setRemoveAttendees(false);
    setResetStatus(true);
    setSuccess('Hafta verileri sıfırlandı.');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        className="text-sm text-red-600 underline"
      >
        Hafta Verilerini Sıfırla
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {success && <span className="text-xs text-green-700">{success}</span>}

      <ConfirmDialog
        open={confirmReset}
        title={`${weekDateLabel} haftasının verileri sıfırlansın mı?`}
        details={[
          { label: 'Takım', value: teamCount },
          { label: 'Maç', value: matchCount },
          { label: 'Set', value: setCount },
          { label: 'MVP kaydı', value: mvpCount },
          { label: 'Katılımcı', value: attendeeCount },
        ]}
        warning={
          resetStatus
            ? 'Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir ve hafta Taslak durumuna alınacaktır. Bu işlem geri alınamaz.'
            : `Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir; hafta durumu değişmeyecek (mevcut: ${WEEK_STATUS_LABELS[currentStatus]}). Bu işlem geri alınamaz.`
        }
        confirmLabel={busy ? 'Sıfırlanıyor…' : 'Verileri Sıfırla'}
        cancelLabel="Vazgeç"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      >
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={removeAttendees}
            onChange={(e) => setRemoveAttendees(e.target.checked)}
          />
          Katılımcıları da temizle
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={resetStatus}
            onChange={(e) => setResetStatus(e.target.checked)}
          />
          Haftayı Taslak durumuna al
        </label>
      </ConfirmDialog>
    </div>
  );
}
