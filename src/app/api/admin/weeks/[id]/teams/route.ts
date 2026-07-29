import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface TeamInput {
  name: string;
  playerIds: string[];
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const teams: TeamInput[] = body.teams;
  if (!Array.isArray(teams) || teams.length < 2) {
    return NextResponse.json({ error: 'En az 2 takım gerekli' }, { status: 400 });
  }
  for (const team of teams) {
    if (typeof team.name !== 'string' || team.name.trim().length === 0) {
      return NextResponse.json({ error: 'Her takımın bir adı olmalı' }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.team.deleteMany({ where: { weekId: params.id } });
    for (const team of teams) {
      await tx.team.create({
        data: {
          weekId: params.id,
          name: team.name.trim(),
          players: { create: team.playerIds.map((playerId) => ({ playerId })) },
        },
      });
    }
  });

  const savedTeams = await prisma.team.findMany({
    where: { weekId: params.id },
    include: { players: { include: { player: true } } },
  });
  return NextResponse.json({ teams: savedTeams });
}
