import { NextRequest, NextResponse } from 'next/server';
import { joinGame } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  const { name, note } = typeof body === 'object' && body !== null ? (body as { name?: unknown; note?: unknown }) : {};
  try {
    const result = await joinGame(params.id, name, note);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
