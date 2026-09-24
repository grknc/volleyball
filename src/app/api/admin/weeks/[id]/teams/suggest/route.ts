import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { balanceTeams } from '@/lib/teamBalancer';
import { getRatingSnapshot, ratingOf } from '@/lib/ratingService';

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
  // Takımlar pozisyonlara ve maçlarla güncellenen dinamik seviyeye göre dengelenir.
  const snapshot = await getRatingSnapshot();
  const players = attendees.map((a) => ({
    id: a.player.id,
    name: a.player.name,
    position: a.player.position,
    level: Math.round(ratingOf(snapshot, a.player.id) * 100) / 100,
  }));
  const rawVariation = Number(body.variation ?? 0);
  const variation = Number.isFinite(rawVariation) ? Math.min(3, Math.max(0, rawVariation)) : 0;
  const teams = balanceTeams(players, teamCount, { variation });
  return NextResponse.json({ teams });
}
