import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMatchResult } from '@/lib/matchScoring';
import { isWeekEditableForScores, type WeekStatus } from '@/lib/constants';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.match.findUnique({ where: { id: params.id }, include: { week: true } });
  if (!existing) {
    return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 });
  }
  if (!isWeekEditableForScores(existing.week.status as WeekStatus)) {
    return NextResponse.json({ error: 'Bu hafta için skor girilemez' }, { status: 403 });
  }

  const body = await request.json();
  const sets = body.sets;
  if (!Array.isArray(sets)) {
    return NextResponse.json({ error: 'Set skorları gerekli' }, { status: 400 });
  }
  try {
    computeMatchResult(sets);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const match = await prisma.match.update({ where: { id: params.id }, data: { sets } });
  return NextResponse.json({ match });
}
