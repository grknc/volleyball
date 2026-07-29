import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ players });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, level } = body;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'İsim gerekli' }, { status: 400 });
  }
  if (typeof level !== 'number' || level < 1 || level > 10) {
    return NextResponse.json({ error: 'Seviye 1-10 arasında olmalı' }, { status: 400 });
  }
  const player = await prisma.player.create({ data: { name: name.trim(), level } });
  return NextResponse.json({ player }, { status: 201 });
}
