import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMatchResult } from '@/lib/matchScoring';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.match.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 });
  }

  const body = await request.json();
  const sets = body.sets;
  if (!Array.isArray(sets)) {
    return NextResponse.json({ error: 'Set skorları gerekli' }, { status: 400 });
  }
  if (sets.length > 0) {
    try {
      computeMatchResult(sets, existing.targetPoints ?? undefined);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }
  const match = await prisma.match.update({ where: { id: params.id }, data: { sets } });
  return NextResponse.json({ match });
}
