import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isValidWeekStatus } from '@/lib/constants';
import { canDeleteWeek } from '@/lib/weekDeletion';
import type { SetScore } from '@/lib/matchScoring';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
    },
  });
  if (!week) {
    return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
  }
  return NextResponse.json({ week });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const data: { date?: Date; status?: string } = {};

  if (body.date !== undefined) {
    if (typeof body.date !== 'string' || isNaN(Date.parse(body.date))) {
      return NextResponse.json({ error: 'Geçerli bir tarih gerekli' }, { status: 400 });
    }
    data.date = new Date(body.date);
  }
  if (body.status !== undefined) {
    if (!isValidWeekStatus(body.status)) {
      return NextResponse.json({ error: 'Geçersiz durum değeri' }, { status: 400 });
    }
    data.status = body.status;
  }

  const existing = await prisma.week.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
  }

  const week = await prisma.week.update({ where: { id: params.id }, data });
  return NextResponse.json({ week });
}

class WeekNotFoundError extends Error {}
class WeekHasResultsError extends Error {}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.$transaction(async (tx) => {
      const week = await tx.week.findUnique({
        where: { id: params.id },
        include: { matches: true },
      });
      if (!week) throw new WeekNotFoundError();

      const deletable = canDeleteWeek(week.matches.map((m) => ({ sets: m.sets as SetScore[] })));
      if (!deletable) throw new WeekHasResultsError();

      await tx.week.delete({ where: { id: params.id } });
    });
  } catch (err) {
    if (err instanceof WeekNotFoundError) {
      return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
    }
    if (err instanceof WeekHasResultsError) {
      return NextResponse.json(
        { error: 'WEEK_HAS_RESULTS', message: 'Sonuç girilmiş haftalar silinemez. Önce arşivleyin.' },
        { status: 409 }
      );
    }
    console.error('[DELETE /api/admin/weeks/:id]', err);
    return NextResponse.json({ error: 'Hafta silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
