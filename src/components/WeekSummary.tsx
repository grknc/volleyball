import { WEEK_STATUS_LABELS, type WeekStatus } from '@/lib/constants';
import type { WeekViewData } from '@/lib/weekView';

const STATUS_BADGE_CLASSES: Record<WeekStatus, string> = {
  draft: 'bg-slate-200 text-slate-700',
  published: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
  archived: 'bg-slate-200 text-slate-500',
};

export function WeekStatusBadge({ status }: { status: WeekStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}>
      {WEEK_STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

export function WeekSummary({ week }: { week: WeekViewData }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
        <WeekStatusBadge status={week.status} />
      </div>

      {week.status === 'cancelled' && (
        <p className="text-red-700 text-sm mb-4 border border-red-200 bg-red-50 rounded p-3">
          Bu hafta iptal edildi.
        </p>
      )}

      {week.mvps.length > 0 && (
        <p className="text-sm text-slate-600 mb-4">
          Haftanın Oyuncusu: {week.mvps.map((m) => m.name).join(', ')}
        </p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Oyuncu" value={week.attendeeCount} />
        <StatCard label="Takım" value={week.teamCount} />
        <StatCard label="Maç" value={week.matchCount} />
        <StatCard label="Oynanan Set" value={week.setCount} />
      </section>
    </div>
  );
}
