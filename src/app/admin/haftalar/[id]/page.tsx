import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TeamBuilder } from '@/components/TeamBuilder';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
    },
  });
  if (!week) notFound();

  const attendeePlayers = week.attendees.map((a) => a.player);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>

      <TeamBuilder weekId={week.id} attendees={attendeePlayers} initialTeams={week.teams} />
    </div>
  );
}
