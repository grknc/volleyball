import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { balanceTeams } from '@/lib/teamBalancer';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const teamCount = Number(body.teamCount);
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return NextResponse.json({ error: 'Takım sayısı en az 2 olmalı' }, { status: 400 });
  }
  const attendees = await prisma.weekAttendee.findMany({
    where: { weekId: params.id },
    include: { player: true },
  });
  if (attendees.length < teamCount) {
    return NextResponse.json({ error: 'Katılımcı sayısı takım sayısından az' }, { status: 400 });
  }
  const players = attendees.map((a) => ({ id: a.player.id, name: a.player.name, level: a.player.level }));
  const teams = balanceTeams(players, teamCount);
  return NextResponse.json({ teams });
}
