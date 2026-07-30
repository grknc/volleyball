import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isValidAvatarUrl, isValidPlayerPosition } from '@/lib/constants';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    data.name = body.name.trim();
  }
  if (typeof body.level === 'number') {
    if (body.level < 1 || body.level > 10) {
      return NextResponse.json({ error: 'Seviye 1-10 arasında olmalı' }, { status: 400 });
    }
    data.level = body.level;
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
    data.notes = body.notes;
  }

  const player = await prisma.player.update({ where: { id: params.id }, data });
  return NextResponse.json({ player });
}
