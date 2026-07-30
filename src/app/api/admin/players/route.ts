import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isValidAvatarUrl, isValidPlayerPosition } from '@/lib/constants';

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ players });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, level, position, heightCm, avatarUrl, notes } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'İsim gerekli' }, { status: 400 });
  }
  if (typeof level !== 'number' || level < 1 || level > 10) {
    return NextResponse.json({ error: 'Seviye 1-10 arasında olmalı' }, { status: 400 });
  }
  if (position !== undefined && position !== null && !isValidPlayerPosition(position)) {
    return NextResponse.json({ error: 'Geçersiz pozisyon' }, { status: 400 });
  }
  if (
    heightCm !== undefined &&
    heightCm !== null &&
    (typeof heightCm !== 'number' || heightCm < 100 || heightCm > 250)
  ) {
    return NextResponse.json({ error: 'Boy 100-250 cm arasında olmalı' }, { status: 400 });
  }
  if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '' && !isValidAvatarUrl(avatarUrl)) {
    return NextResponse.json({ error: "Geçersiz görsel URL'si" }, { status: 400 });
  }
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return NextResponse.json({ error: 'Not metin olmalı' }, { status: 400 });
  }

  const player = await prisma.player.create({
    data: {
      name: name.trim(),
      level,
      position: position || null,
      heightCm: heightCm ?? null,
      avatarUrl: avatarUrl || null,
      notes: notes || null,
    },
  });
  return NextResponse.json({ player }, { status: 201 });
}
