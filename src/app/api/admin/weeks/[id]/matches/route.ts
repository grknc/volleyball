import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { teamAId, teamBId } = body;
  if (typeof teamAId !== 'string' || typeof teamBId !== 'string' || teamAId === teamBId) {
    return NextResponse.json({ error: 'İki farklı takım seçmelisin' }, { status: 400 });
  }
  const match = await prisma.match.create({
    data: { weekId: params.id, teamAId, teamBId, sets: [] },
  });
  return NextResponse.json({ match }, { status: 201 });
}
