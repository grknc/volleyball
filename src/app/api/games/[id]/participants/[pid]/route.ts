import { NextRequest, NextResponse } from 'next/server';
import { removeParticipant } from '@/lib/gameService';
import { gameErrorResponse } from '@/lib/gameHttp';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pid: string } }) {
  try {
    await removeParticipant(params.id, params.pid, {
      leaveToken: request.headers.get('x-leave-token'),
      manageToken: request.headers.get('x-manage-token'),
    });
  } catch (err) {
    return gameErrorResponse(err);
  }
  return NextResponse.json({ success: true });
}
