import { PlayerAvatar } from '@/components/PlayerAvatar';
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

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-2">
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-xs text-slate-600">{label}</p>
      </div>
    </div>
  );
}

export function WeekSummary({ week }: { week: WeekViewData }) {
  const mvp = week.mvps[0];

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1 className="text-xl font-bold">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
        <WeekStatusBadge status={week.status} />
      </div>

      {week.status === 'cancelled' && (
        <p className="text-red-700 text-sm mb-4 border border-red-200 bg-red-50 rounded p-3">
          Bu hafta iptal edildi.
        </p>
      )}

      {mvp && (
        <div className="flex items-center gap-2 mb-4 text-sm text-slate-700">
          <PlayerAvatar name={mvp.name} avatarUrl={mvp.avatarUrl} sizeClassName="w-6 h-6" />
          <span>
            ⭐ Haftanın Oyuncusu: <span className="font-semibold">{mvp.name}</span>
          </span>
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="👥" label="Oyuncu" value={week.attendeeCount} />
        <StatCard icon="🏐" label="Takım" value={week.teamCount} />
        <StatCard icon="🎯" label="Maç" value={week.matchCount} />
        <StatCard icon="🔥" label="Set" value={week.setCount} />
      </section>
    </div>
  );
}
