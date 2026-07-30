import { NextRequest, NextResponse } from 'next/server';
import { getPlayerLeaderboards, parseStatisticsScope } from '@/lib/statisticsService';

export async function GET(request: NextRequest) {
  const parsed = parseStatisticsScope(request.nextUrl.searchParams);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const leaderboards = await getPlayerLeaderboards(parsed.scope);
  return NextResponse.json(leaderboards);
}
