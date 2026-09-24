import type { PlayerRatingState } from './rating';
import type { RatingSnapshot } from './ratingService';

/**
 * Rozetler — tamamen maç geçmişinden hesaplanır (DB'de saklanmaz).
 * Her rozet bir sayaç + hedef; sayaç hedefe ilk ulaştığı haftada "kazanıldı" sayılır.
 */

export type BadgeTier = 'bronz' | 'gümüş' | 'altın';

type Metric =
  | 'matches'
  | 'wins'
  | 'streak'
  | 'upsets'
  | 'sweeps'
  | 'comebacks'
  | 'formats'
  | 'weeks'
  | 'mvps'
  | 'ratingGain'
  | 'duoWins';

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  metric: Metric;
  target: number;
  tier: BadgeTier;
}

export const BADGES: BadgeDef[] = [
  { id: 'ilk-mac', icon: '🏐', name: 'İlk Servis', description: 'İlk maçını oyna', metric: 'matches', target: 1, tier: 'bronz' },
  { id: 'mac-10', icon: '🎽', name: 'Müdavim', description: '10 maç oyna', metric: 'matches', target: 10, tier: 'bronz' },
  { id: 'mac-25', icon: '🏟️', name: 'Demirbaş', description: '25 maç oyna', metric: 'matches', target: 25, tier: 'gümüş' },
  { id: 'mac-50', icon: '🗿', name: 'Efsane', description: '50 maç oyna', metric: 'matches', target: 50, tier: 'altın' },
  { id: 'ilk-galibiyet', icon: '🥇', name: 'İlk Zafer', description: 'İlk galibiyetini al', metric: 'wins', target: 1, tier: 'bronz' },
  { id: 'galibiyet-10', icon: '🏆', name: 'Kazanan', description: '10 galibiyet', metric: 'wins', target: 10, tier: 'gümüş' },
  { id: 'galibiyet-25', icon: '👑', name: 'Şampiyon', description: '25 galibiyet', metric: 'wins', target: 25, tier: 'altın' },
  { id: 'seri-3', icon: '🔥', name: 'Alev Aldı', description: 'Üst üste 3 galibiyet', metric: 'streak', target: 3, tier: 'bronz' },
  { id: 'seri-5', icon: '⚡', name: 'Durdurulamaz', description: 'Üst üste 5 galibiyet', metric: 'streak', target: 5, tier: 'altın' },
  { id: 'dev-avcisi', icon: '🎯', name: 'Dev Avcısı', description: 'Kazanma şansı %40’ın altındayken kazan', metric: 'upsets', target: 1, tier: 'gümüş' },
  { id: 'supurge', icon: '🧹', name: 'Süpürge', description: '5 kez 2-0 kazan', metric: 'sweeps', target: 5, tier: 'gümüş' },
  { id: 'geri-donus', icon: '🔄', name: 'Geri Dönüş', description: 'İlk seti kaybettiğin maçı kazan', metric: 'comebacks', target: 1, tier: 'bronz' },
  { id: 'cok-yonlu', icon: '🎨', name: 'Çok Yönlü', description: '3 farklı formatta oyna (2x2, 4x4, 6x6…)', metric: 'formats', target: 3, tier: 'gümüş' },
  { id: 'ikili-usta', icon: '🏖️', name: 'İkili Ustası', description: '2x2 formatında 3 galibiyet', metric: 'duoWins', target: 3, tier: 'gümüş' },
  { id: 'sadik-5', icon: '📅', name: 'Sadık', description: '5 farklı haftada oyna', metric: 'weeks', target: 5, tier: 'bronz' },
  { id: 'sadik-15', icon: '🗓️', name: 'Sezonun Direği', description: '15 farklı haftada oyna', metric: 'weeks', target: 15, tier: 'altın' },
  { id: 'mvp-1', icon: '⭐', name: 'Haftanın Yıldızı', description: 'Haftanın Oyuncusu seçil', metric: 'mvps', target: 1, tier: 'gümüş' },
  { id: 'mvp-3', icon: '🌟', name: 'Yıldızlar Karması', description: '3 kez Haftanın Oyuncusu seçil', metric: 'mvps', target: 3, tier: 'altın' },
  { id: 'yukselis', icon: '📈', name: 'Yükselişte', description: 'Başlangıç seviyenin 0,50 üstüne çık', metric: 'ratingGain', target: 0.5, tier: 'gümüş' },
  { id: 'roket', icon: '🚀', name: 'Roket', description: 'Başlangıç seviyenin 1,00 üstüne çık', metric: 'ratingGain', target: 1, tier: 'altın' },
];

export interface PlayerBadge {
  def: BadgeDef;
  earned: boolean;
  current: number;
  earnedAt: { weekId: string; date: string } | null;
}

type Event =
  | { kind: 'match'; date: Date; weekId: string; h: PlayerRatingState['history'][number] }
  | { kind: 'mvp'; date: Date; weekId: string };

export function computeBadges(
  state: PlayerRatingState,
  mvps: Array<{ weekId: string; weekDate: Date }> = []
): PlayerBadge[] {
  const events: Event[] = [
    ...state.history.map((h) => ({ kind: 'match' as const, date: h.weekDate, weekId: h.weekId, h })),
    ...mvps.map((m) => ({ kind: 'mvp' as const, date: m.weekDate, weekId: m.weekId })),
  ];
  // Aynı gün: önce maçlar, sonra MVP (stable sort)
  events.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === b.kind ? 0 : a.kind === 'match' ? -1 : 1));

  const values: Record<Metric, number> = {
    matches: 0,
    wins: 0,
    streak: 0,
    upsets: 0,
    sweeps: 0,
    comebacks: 0,
    formats: 0,
    weeks: 0,
    mvps: 0,
    ratingGain: 0,
    duoWins: 0,
  };
  let running = 0;
  const formats = new Set<string>();
  const weeks = new Set<string>();
  const earnedAt = new Map<string, { weekId: string; date: string }>();

  for (const e of events) {
    if (e.kind === 'match') {
      const h = e.h;
      values.matches += 1;
      if (h.won) {
        values.wins += 1;
        running += 1;
        if (h.expected < 0.4) values.upsets += 1;
        if (h.sweep) values.sweeps += 1;
        if (h.cameBack) values.comebacks += 1;
        if (h.format === '2x2') values.duoWins += 1;
      } else {
        running = 0;
      }
      values.streak = Math.max(values.streak, running);
      formats.add(h.format);
      values.formats = formats.size;
      weeks.add(h.weekId);
      values.weeks = weeks.size;
      values.ratingGain = Math.max(values.ratingGain, h.after - state.baseLevel);
    } else {
      values.mvps += 1;
    }

    for (const b of BADGES) {
      if (!earnedAt.has(b.id) && values[b.metric] >= b.target - 1e-9) {
        earnedAt.set(b.id, { weekId: e.weekId, date: e.date.toISOString() });
      }
    }
  }

  return BADGES.map((def) => ({
    def,
    earned: earnedAt.has(def.id),
    current: values[def.metric],
    earnedAt: earnedAt.get(def.id) ?? null,
  }));
}

export function badgesForPlayer(snapshot: RatingSnapshot, playerId: string): PlayerBadge[] {
  const state = snapshot.players.get(playerId);
  if (!state) return [];
  return computeBadges(state, snapshot.mvpsByPlayer.get(playerId) ?? []);
}

export interface WeekBadgeHighlight {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  badges: BadgeDef[];
}

/** Belirli bir haftada kazanılan rozetler (hafta sayfası için). */
export function badgesEarnedInWeek(snapshot: RatingSnapshot, weekId: string): WeekBadgeHighlight[] {
  const result: WeekBadgeHighlight[] = [];
  for (const [playerId, info] of snapshot.playersById) {
    const earned = badgesForPlayer(snapshot, playerId)
      .filter((b) => b.earnedAt?.weekId === weekId)
      .map((b) => b.def);
    if (earned.length > 0) result.push({ playerId, name: info.name, avatarUrl: info.avatarUrl, badges: earned });
  }
  return result.sort((a, b) => b.badges.length - a.badges.length || a.name.localeCompare(b.name, 'tr'));
}
