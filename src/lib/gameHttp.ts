import { NextResponse } from 'next/server';
import { GameError } from '@/lib/gameService';

/** GameError'ı `{ error }` yanıtına çevirir; beklenmeyen hatayı yeniden fırlatır. */
export function gameErrorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
