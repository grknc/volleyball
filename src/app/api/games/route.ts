import { NextRequest, NextResponse } from 'next/server';
import { validateGameInput } from '@/lib/games';
import { createGame } from '@/lib/gameService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = validateGameInput(body, { now: new Date(), requireFuture: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const created = await createGame(parsed.value);
  return NextResponse.json(created, { status: 201 });
}
