import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const data: { name?: string; level?: number; isActive?: boolean } = {};

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

  const player = await prisma.player.update({ where: { id: params.id }, data });
  return NextResponse.json({ player });
}
