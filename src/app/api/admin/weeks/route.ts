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
  if (!Array.isArray(attendeePlayerIds) || attendeePlayerIds.length === 0) {
    return NextResponse.json({ error: 'En az bir katılımcı seçmelisin' }, { status: 400 });
  }
  const week = await prisma.week.create({
    data: {
      date: new Date(date),
      attendees: {
        create: attendeePlayerIds.map((playerId: string) => ({ playerId })),
      },
    },
  });
  return NextResponse.json({ week }, { status: 201 });
}
