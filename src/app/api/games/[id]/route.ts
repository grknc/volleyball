import { NextRequest, NextResponse } from 'next/server';
import { isGameStatus, validateGameInput, type GameInput, type GameStatus } from '@/lib/games';
import { getGameView, updateGame } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  const { game, status } = body as { game?: unknown; status?: unknown };
  const changes: { input?: GameInput; status?: GameStatus } = {};

  if (game !== undefined) {
    // Düzenlemede tarih geçmişte kalmış olabilir; yalnızca oluştururken gelecek şartı aranır.
    const parsed = validateGameInput(game, { now: new Date(), requireFuture: false });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    changes.input = parsed.value;
  }
  if (status !== undefined) {
    if (!isGameStatus(status)) {
      return NextResponse.json({ error: 'Geçersiz durum değeri' }, { status: 400 });
    }
    changes.status = status;
  }
  if (!changes.input && !changes.status) {
    return NextResponse.json({ error: 'Değişiklik gönderilmedi' }, { status: 400 });
  }

  try {
    await updateGame(params.id, request.headers.get('x-manage-token'), changes);
  } catch (err) {
    return gameErrorResponse(err);
  }
  return NextResponse.json({ game: await getGameView(params.id) });
}
