'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WEEK_STATUSES, WEEK_STATUS_LABELS, type WeekStatus } from '@/lib/constants';

export function WeekStatusControl({ weekId, initialStatus }: { weekId: string; initialStatus: WeekStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<WeekStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: WeekStatus) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Durum güncellenemedi');
      return;
    }
    setStatus(newStatus);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-sm font-medium" htmlFor="week-status">
        Durum
      </label>
      <select
        id="week-status"
        value={status}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value as WeekStatus)}
        className="border rounded px-2 py-1"
      >
        {WEEK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {WEEK_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
