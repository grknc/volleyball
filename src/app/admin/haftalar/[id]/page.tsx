import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TeamBuilder } from '@/components/TeamBuilder';
import { FixtureManager } from '@/components/FixtureManager';
import { MvpPicker } from '@/components/MvpPicker';
import { WeekStatusControl } from '@/components/WeekStatusControl';
import { WeekResetControl } from '@/components/WeekResetControl';
import type { WeekStatus } from '@/lib/constants';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
    },
  });
  if (!week) notFound();

  const attendeePlayers = week.attendees.map((a) => a.player);
  const setCount = week.matches.reduce(
    (sum, m) => sum + (m.sets as [number, number][]).length,
    0
  );

  const resetKey = `${week.status}-${week.teams.length}-${week.matches.length}-${week.mvps.length}-${week.attendees.length}`;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <div key={`${resetKey}-status`}>
        <WeekStatusControl weekId={week.id} initialStatus={week.status as WeekStatus} />
      </div>
      <WeekResetControl
        weekId={week.id}
        weekDateLabel={new Date(week.date).toLocaleDateString('tr-TR')}
        currentStatus={week.status as WeekStatus}
        teamCount={week.teams.length}
        matchCount={week.matches.length}
        setCount={setCount}
        mvpCount={week.mvps.length}
        attendeeCount={week.attendees.length}
      />
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>

      <div key={`${resetKey}-rest`}>
        <TeamBuilder weekId={week.id} attendees={attendeePlayers} initialTeams={week.teams} />

        <FixtureManager
          weekId={week.id}
          teams={week.teams.map((t) => ({ id: t.id, name: t.name }))}
          initialMatches={week.matches.map((m) => ({
            id: m.id,
            teamAId: m.teamAId,
            teamBId: m.teamBId,
            sets: m.sets as [number, number][],
            targetPoints: m.targetPoints,
          }))}
        />

        <MvpPicker
          weekId={week.id}
          attendees={attendeePlayers}
          initialMvpPlayerIds={week.mvps.map((m) => m.playerId)}
        />
      </div>
    </div>
  );
}
