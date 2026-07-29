import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const playerIds = body.playerIds;
  if (!Array.isArray(playerIds)) {
    return NextResponse.json({ error: 'Oyuncu listesi gerekli' }, { status: 400 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.weeklyMvp.deleteMany({ where: { weekId: params.id } });
    for (const playerId of playerIds) {
      await tx.weeklyMvp.create({ data: { weekId: params.id, playerId } });
    }
  });
  const mvps = await prisma.weeklyMvp.findMany({ where: { weekId: params.id }, include: { player: true } });
  return NextResponse.json({ mvps });
}
