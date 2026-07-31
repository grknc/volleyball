import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resetWeekData, WeekNotFoundError } from '@/lib/weekResetService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));

  const removeAttendees = body.removeAttendees ?? false;
  const resetStatus = body.resetStatus ?? false;

  if (typeof removeAttendees !== 'boolean' || typeof resetStatus !== 'boolean') {
    return NextResponse.json(
      { error: 'removeAttendees ve resetStatus boolean olmalı' },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction((tx) =>
      resetWeekData(tx, params.id, { removeAttendees, resetStatus })
    );
    return NextResponse.json({ success: true, weekId: params.id, ...result });
  } catch (err) {
    if (err instanceof WeekNotFoundError) {
      return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
    }
    console.error('[POST /api/admin/weeks/:id/reset]', err);
    return NextResponse.json({ error: 'Hafta verileri sıfırlanamadı' }, { status: 500 });
  }
}
