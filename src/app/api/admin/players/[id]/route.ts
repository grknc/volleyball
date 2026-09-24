import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isValidAvatarUrl, isValidPlayerLevel, isValidPlayerPosition, roundLevel } from '@/lib/constants';
import { deletePlayer, PlayerHasHistoryError } from '@/lib/adminPlayers';
import { engineInputs, getRatingSnapshot } from '@/lib/ratingService';
import { solveBaseLevel } from '@/lib/rating';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.player.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Oyuncu bulunamadı' }, { status: 404 });
  }

  const body = await request.json();
  const data: {
    name?: string;
    level?: number;
    isActive?: boolean;
    position?: string | null;
    heightCm?: number | null;
    avatarUrl?: string | null;
    notes?: string | null;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'İsim boş olamaz' }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.level !== undefined && body.currentLevel !== undefined) {
    return NextResponse.json(
      { error: 'Başlangıç ve güncel seviyeden yalnızca birini değiştir' },
      { status: 400 }
    );
  }
  if (body.level !== undefined) {
    if (!isValidPlayerLevel(body.level)) {
      return NextResponse.json({ error: 'Seviye 0,5-10 arasında olmalı' }, { status: 400 });
    }
    data.level = roundLevel(body.level);
  }
  if (body.currentLevel !== undefined) {
    if (!isValidPlayerLevel(body.currentLevel)) {
      return NextResponse.json({ error: 'Seviye 0,5-10 arasında olmalı' }, { status: 400 });
    }
    // Güncel seviyeyi hedefle: maç geçmişi oynatıldığında bu seviyeyi veren başlangıç seviyesini bul.
    const snapshot = await getRatingSnapshot();
    const { players, matches } = engineInputs(snapshot);
    const { baseLevel } = solveBaseLevel(players, matches, params.id, body.currentLevel);
    data.level = baseLevel;
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
  }
  if (body.position !== undefined) {
    if (body.position !== null && !isValidPlayerPosition(body.position)) {
      return NextResponse.json({ error: 'Geçersiz pozisyon' }, { status: 400 });
    }
    data.position = body.position;
  }
  if (body.heightCm !== undefined) {
    if (
      body.heightCm !== null &&
      (typeof body.heightCm !== 'number' || body.heightCm < 100 || body.heightCm > 250)
    ) {
      return NextResponse.json({ error: 'Boy 100-250 cm arasında olmalı' }, { status: 400 });
    }
    data.heightCm = body.heightCm;
  }
  if (body.avatarUrl !== undefined) {
    if (body.avatarUrl !== null && body.avatarUrl !== '' && !isValidAvatarUrl(body.avatarUrl)) {
      return NextResponse.json({ error: "Geçersiz görsel URL'si" }, { status: 400 });
    }
    data.avatarUrl = body.avatarUrl || null;
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Not metin olmalı' }, { status: 400 });
    }
    data.notes = body.notes || null;
  }

  const player = await prisma.player.update({ where: { id: params.id }, data });
  return NextResponse.json({ player });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const force = request.nextUrl.searchParams.get('force') === '1';
  try {
    const { promoted } = await deletePlayer(params.id, { force });
    return NextResponse.json({ success: true, promoted });
  } catch (err) {
    if (err instanceof PlayerHasHistoryError) {
      return NextResponse.json(
        {
          error: 'PLAYER_HAS_MATCHES',
          matches: err.matches,
          message: `Bu oyuncu ${err.matches} maçta oynadı. Silinirse bu maçların kadrosundan çıkar ve diğer oyuncuların seviyeleri yeniden hesaplanır. Bunun yerine pasife almanı öneririm.`,
        },
        { status: 409 }
      );
    }
    if ((err as Error).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Oyuncu bulunamadı' }, { status: 404 });
    }
    console.error('[DELETE /api/admin/players/:id]', err);
    return NextResponse.json({ error: 'Oyuncu silinemedi' }, { status: 500 });
  }
}
