import { NextRequest, NextResponse } from 'next/server';
import { getOverview, parseStatisticsScope } from '@/lib/statisticsService';

export async function GET(request: NextRequest) {
  const parsed = parseStatisticsScope(request.nextUrl.searchParams);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const overview = await getOverview(parsed.scope);
  return NextResponse.json(overview);
}
