import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AttendanceError, getWeekAttendance, isRsvpChoice, setAttendance } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!week || week.status === 'draft') {
    return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
  }
  const attendance = await getWeekAttendance(params.id);
  return NextResponse.json({ attendance });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const { playerId, choice } = body as { playerId?: unknown; choice?: unknown };
  if (typeof playerId !== 'string' || !isRsvpChoice(choice)) {
    return NextResponse.json({ error: 'Oyuncu ve seçim (yes/no/none) gerekli' }, { status: 400 });
  }
  try {
    await setAttendance(params.id, playerId, choice);
  } catch (err) {
    if (err instanceof AttendanceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  const attendance = await getWeekAttendance(params.id);
  return NextResponse.json({ attendance });
}
