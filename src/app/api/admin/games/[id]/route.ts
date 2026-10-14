import { NextResponse } from 'next/server';
import { deleteGame } from '@/lib/gameService';

// Yetki kontrolü src/middleware.ts içinde (/api/admin/:path*).
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const deleted = await deleteGame(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Oyun bulunamadı' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
