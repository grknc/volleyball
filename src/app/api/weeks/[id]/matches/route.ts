import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isValidTargetPoints, isWeekEditableForScores, type WeekStatus } from '@/lib/constants';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({ where: { id: params.id } });
  if (!week) {
    return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
  }
  if (!isWeekEditableForScores(week.status as WeekStatus)) {
    return NextResponse.json({ error: 'Bu hafta için maç eklenemez' }, { status: 403 });
  }

  const body = await request.json();
  const { teamAId, teamBId, targetPoints } = body;
  if (typeof teamAId !== 'string' || typeof teamBId !== 'string' || teamAId === teamBId) {
    return NextResponse.json({ error: 'İki farklı takım seçmelisin' }, { status: 400 });
  }
  if (!isValidTargetPoints(targetPoints)) {
    return NextResponse.json({ error: 'Maçın kaç sayıya oynanacağını seçmelisin (25 veya 21)' }, { status: 400 });
  }
  const match = await prisma.match.create({
    data: { weekId: params.id, teamAId, teamBId, sets: [], targetPoints },
  });
  return NextResponse.json({ match }, { status: 201 });
}
