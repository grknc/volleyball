import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMatchResult } from '@/lib/matchScoring';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
