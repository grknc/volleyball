import { NextRequest, NextResponse } from 'next/server';
import { getMatchRecords, parseStatisticsScope } from '@/lib/statisticsService';

export async function GET(request: NextRequest) {
  const parsed = parseStatisticsScope(request.nextUrl.searchParams);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const records = await getMatchRecords(parsed.scope);
  return NextResponse.json(records);
}
