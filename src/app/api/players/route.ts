import { NextRequest, NextResponse } from 'next/server';
import { listPlayers, type PlayerListFilters } from '@/lib/playerService';
import { isValidPlayerPosition } from '@/lib/constants';

const SORT_VALUES = ['name', 'matches', 'wins', 'winRate', 'mvps', 'level', 'points'] as const;
const ORDER_VALUES = ['asc', 'desc'] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters: PlayerListFilters = {};

  const search = params.get('search');
  if (search) filters.search = search;

  const position = params.get('position');
  if (position) {
    if (!isValidPlayerPosition(position)) {
      return NextResponse.json({ error: 'Geçersiz pozisyon' }, { status: 400 });
    }
    filters.position = position;
  }

  const skillLevel = params.get('skillLevel');
  if (skillLevel !== null) {
    const parsed = Number(skillLevel);
    if (!Number.isInteger(parsed)) {
      return NextResponse.json({ error: 'skillLevel bir tam sayı olmalı' }, { status: 400 });
    }
    filters.skillLevel = parsed;
  }

  const sortBy = params.get('sortBy');
  if (sortBy) {
    if (!SORT_VALUES.includes(sortBy as (typeof SORT_VALUES)[number])) {
      return NextResponse.json({ error: 'Geçersiz sortBy değeri' }, { status: 400 });
    }
    filters.sortBy = sortBy as PlayerListFilters['sortBy'];
  }

  const order = params.get('order');
  if (order) {
    if (!ORDER_VALUES.includes(order as (typeof ORDER_VALUES)[number])) {
      return NextResponse.json({ error: 'Geçersiz order değeri' }, { status: 400 });
    }
    filters.order = order as PlayerListFilters['order'];
  }

  const minMatches = params.get('minMatches');
  if (minMatches !== null) {
    const parsed = Number(minMatches);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'minMatches negatif olmayan bir tam sayı olmalı' }, { status: 400 });
    }
    filters.minMatches = parsed;
  }

  const limit = params.get('limit');
  if (limit !== null) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json({ error: 'limit 1-100 arasında bir tam sayı olmalı' }, { status: 400 });
    }
    filters.limit = parsed;
  }

  const offset = params.get('offset');
  if (offset !== null) {
    const parsed = Number(offset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'offset negatif olmayan bir tam sayı olmalı' }, { status: 400 });
    }
    filters.offset = parsed;
  }

  const result = await listPlayers(filters);
  return NextResponse.json(result);
}
