import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const weeks = await prisma.week.findMany({ orderBy: { date: 'desc' } });
  return NextResponse.json({ weeks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, attendeePlayerIds } = body;
  if (typeof date !== 'string' || isNaN(Date.parse(date))) {
    return NextResponse.json({ error: 'Geçerli bir tarih gerekli' }, { status: 400 });
  }
  // Katılımcı listesi boş olabilir: hafta yayınlanınca oyuncular kendileri bildirir.
  if (attendeePlayerIds !== undefined && !Array.isArray(attendeePlayerIds)) {
    return NextResponse.json({ error: 'Katılımcı listesi geçersiz' }, { status: 400 });
  }
  const ids: string[] = Array.isArray(attendeePlayerIds)
    ? attendeePlayerIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const week = await prisma.week.create({
    data: {
      date: new Date(date),
      attendees: {
        create: ids.map((playerId) => ({ playerId })),
      },
    },
  });
  return NextResponse.json({ week }, { status: 201 });
}
