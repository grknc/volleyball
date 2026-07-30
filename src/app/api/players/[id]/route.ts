import { NextResponse } from 'next/server';
import { getPlayerDetails } from '@/lib/playerService';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const player = await getPlayerDetails(params.id);
  if (!player) {
    return NextResponse.json({ error: 'Oyuncu bulunamadı' }, { status: 404 });
  }

  // integrityWarnings is a server-side diagnostic signal (already logged inside
  // getPlayerDetails) — never expose it in the production public API response.
  if (process.env.NODE_ENV === 'production') {
    const { integrityWarnings: _integrityWarnings, ...publicPlayer } = player;
    return NextResponse.json({ player: publicPlayer });
  }
  return NextResponse.json({ player });
}
