import { computeMatchResult, type SetScore } from './matchScoring';

/**
 * Dinamik seviye (rating) motoru — Playtomic benzeri.
 *
 * Saf fonksiyon: tüm tamamlanmış maçları kronolojik sırayla yeniden oynatır ve
 * her oyuncunun seviyesini, güvenilirliğini, puanını ve maç-maç geçmişini üretir.
 * Veritabanına hiçbir şey yazmaz; geçmiş bir skor düzeltilirse sonraki tüm
 * seviyeler otomatik olarak tutarlı şekilde yeniden hesaplanır.
 *
 * - Başlangıç seviyesi: admin'in verdiği seviye (1-10).
 * - Beklenen sonuç: iki takımın ortalama seviyesine göre Elo formülü.
 * - Değişim: K × skor farkı çarpanı × (gerçek − beklenen).
 * - K, oyuncunun maç sayısı arttıkça (güvenilirlik yükseldikçe) küçülür ve
 *   takım büyüdükçe (bireyin maça etkisi azaldıkça) hafifçe azalır.
 */

export const RATING_MIN = 0.5;
export const RATING_MAX = 10;
/** Seviye farkının beklenen sonuca etkisi: 3 seviye fark ≈ %91 kazanma beklentisi. */
export const RATING_SCALE = 3;
/** Bu kadar maçtan sonra güvenilirlik %100 olur. */
export const RELIABILITY_FULL_AT = 30;
export const K_MIN = 0.2;
export const K_NEW_PLAYER_BONUS = 0.3;

export const VOLLEYBALL_FORMATS = [2, 3, 4, 5, 6] as const;

const TEAM_SIZE_FACTOR: Record<number, number> = { 1: 1.15, 2: 1.1, 3: 1.05, 4: 1, 5: 0.95, 6: 0.9 };

export const POINTS = {
  played: 3,
  win: 10,
  sweepBonus: 2,
  upsetBonus: 5,
  mvp: 15,
} as const;
/** Beklenen kazanma olasılığı bunun altındayken kazanılan maç "sürpriz" sayılır. */
export const UPSET_THRESHOLD = 0.4;

export interface RatingPlayerInput {
  id: string;
  baseLevel: number;
}

export interface RatingMatchInput {
  matchId: string;
  weekId: string;
  weekDate: Date;
  createdAt: Date;
  teamAId: string;
  teamBId: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  sets: SetScore[];
}

export interface RatingMvpInput {
  weekId: string;
  weekDate: Date;
  playerId: string;
}

export interface PlayerMatchRating {
  matchId: string;
  weekId: string;
  weekDate: Date;
  teamId: string;
  opponentTeamId: string;
  before: number;
  after: number;
  delta: number;
  won: boolean;
  sweep: boolean;
  /** İlk seti kaybedip maçı kazandı */
  cameBack: boolean;
  expected: number;
  teamAvg: number;
  opponentAvg: number;
  pointsEarned: number;
  format: string;
}

export interface MatchPlayerRating {
  playerId: string;
  teamId: string;
  before: number;
  after: number;
  delta: number;
}

export interface MatchRatingSnapshot {
  matchId: string;
  winner: 'A' | 'B';
  expectedA: number;
  teamAAvg: number;
  teamBAvg: number;
  format: string;
  players: MatchPlayerRating[];
}

export interface PlayerRatingState {
  playerId: string;
  baseLevel: number;
  rating: number;
  peakRating: number;
  matches: number;
  reliability: number;
  points: number;
  mvpCount: number;
  history: PlayerMatchRating[];
}

export interface RatingEngineResult {
  players: Map<string, PlayerRatingState>;
  matches: Map<string, MatchRatingSnapshot>;
}

export function clampRating(value: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, value));
}

export function expectedScore(teamAvg: number, opponentAvg: number): number {
  return 1 / (1 + Math.pow(10, (opponentAvg - teamAvg) / RATING_SCALE));
}

export function reliabilityFor(matches: number): number {
  return Math.min(1, matches / RELIABILITY_FULL_AT);
}

export function kFactor(matchesBefore: number, teamSize: number): number {
  const base = K_MIN + K_NEW_PLAYER_BONUS * (1 - reliabilityFor(matchesBefore));
  return base * (TEAM_SIZE_FACTOR[teamSize] ?? 0.9);
}

/** Rahat (2-0) ve sayı farkı yüksek galibiyetler seviyeyi biraz daha fazla oynatır. */
export function marginFactor(sets: SetScore[], winner: 'A' | 'B'): number {
  const sweep = sets.length === 2;
  const pointsA = sets.reduce((s, [a]) => s + a, 0);
  const pointsB = sets.reduce((s, [, b]) => s + b, 0);
  const total = pointsA + pointsB;
  const winnerShare = total > 0 ? (winner === 'A' ? pointsA : pointsB) / total : 0.5;
  const dominance = Math.min(0.25, Math.max(0, winnerShare - 0.5));
  return (sweep ? 1.05 : 0.9) + dominance;
}

export function formatLabel(sizeA: number, sizeB: number): string {
  return sizeA === sizeB ? `${sizeA}x${sizeA}` : `${sizeA}x${sizeB}`;
}

export function reliabilityLabel(reliability: number): 'DÜŞÜK' | 'ORTA' | 'YÜKSEK' {
  if (reliability < 0.34) return 'DÜŞÜK';
  if (reliability < 0.67) return 'ORTA';
  return 'YÜKSEK';
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sortMatches(matches: RatingMatchInput[]): RatingMatchInput[] {
  return [...matches].sort(
    (a, b) =>
      a.weekDate.getTime() - b.weekDate.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.matchId.localeCompare(b.matchId)
  );
}

const DEFAULT_BASE_LEVEL = 5;

export function runRatingEngine(
  players: RatingPlayerInput[],
  matches: RatingMatchInput[],
  mvps: RatingMvpInput[] = []
): RatingEngineResult {
  const state = new Map<string, PlayerRatingState>();

  function ensure(playerId: string, baseLevel = DEFAULT_BASE_LEVEL): PlayerRatingState {
    let s = state.get(playerId);
    if (!s) {
      const start = clampRating(baseLevel);
      s = {
        playerId,
        baseLevel: start,
        rating: start,
        peakRating: start,
        matches: 0,
        reliability: 0,
        points: 0,
        mvpCount: 0,
        history: [],
      };
      state.set(playerId, s);
    }
    return s;
  }

  for (const p of players) ensure(p.id, p.baseLevel);

  const matchSnapshots = new Map<string, MatchRatingSnapshot>();

  for (const match of sortMatches(matches)) {
    let result;
    try {
      result = computeMatchResult(match.sets);
    } catch {
      continue;
    }

    // Aynı maçta iki takımda birden görünen oyuncu (veri hatası) hesaba katılmaz.
    const inBoth = new Set(match.teamAPlayerIds.filter((id) => match.teamBPlayerIds.includes(id)));
    const teamA = Array.from(new Set(match.teamAPlayerIds)).filter((id) => !inBoth.has(id));
    const teamB = Array.from(new Set(match.teamBPlayerIds)).filter((id) => !inBoth.has(id));
    if (teamA.length === 0 || teamB.length === 0) continue;

    const stA = teamA.map((id) => ensure(id));
    const stB = teamB.map((id) => ensure(id));
    const avgA = average(stA.map((s) => s.rating));
    const avgB = average(stB.map((s) => s.rating));
    const expectedA = expectedScore(avgA, avgB);
    const margin = marginFactor(match.sets, result.winner);
    const sweep = match.sets.length === 2;
    const format = formatLabel(teamA.length, teamB.length);

    const snapshotPlayers: MatchPlayerRating[] = [];

    const apply = (
      side: PlayerRatingState[],
      isA: boolean,
      teamAvg: number,
      opponentAvg: number
    ) => {
      const won = (result.winner === 'A') === isA;
      const expected = isA ? expectedA : 1 - expectedA;
      const actual = won ? 1 : 0;
      const teamSize = side.length;
      for (const s of side) {
        const before = s.rating;
        const delta = kFactor(s.matches, teamSize) * margin * (actual - expected);
        const after = clampRating(before + delta);
        const pointsEarned =
          POINTS.played +
          (won ? POINTS.win : 0) +
          (won && sweep ? POINTS.sweepBonus : 0) +
          (won && expected < UPSET_THRESHOLD ? POINTS.upsetBonus : 0);

        s.rating = after;
        s.peakRating = Math.max(s.peakRating, after);
        s.matches += 1;
        s.reliability = reliabilityFor(s.matches);
        s.points += pointsEarned;
        const firstSetWon = isA ? match.sets[0][0] > match.sets[0][1] : match.sets[0][1] > match.sets[0][0];
        s.history.push({
          matchId: match.matchId,
          weekId: match.weekId,
          weekDate: match.weekDate,
          teamId: isA ? match.teamAId : match.teamBId,
          opponentTeamId: isA ? match.teamBId : match.teamAId,
          before,
          after,
          delta: after - before,
          won,
          sweep,
          cameBack: won && !firstSetWon,
          expected,
          teamAvg,
          opponentAvg,
          pointsEarned,
          format,
        });
        snapshotPlayers.push({
          playerId: s.playerId,
          teamId: isA ? match.teamAId : match.teamBId,
          before,
          after,
          delta: after - before,
        });
      }
    };

    // Her iki taraf da maç ÖNCESİ ortalamalarla hesaplanır (sıra etkisi yok).
    apply(stA, true, avgA, avgB);
    apply(stB, false, avgB, avgA);

    matchSnapshots.set(match.matchId, {
      matchId: match.matchId,
      winner: result.winner,
      expectedA,
      teamAAvg: avgA,
      teamBAvg: avgB,
      format,
      players: snapshotPlayers,
    });
  }

  for (const mvp of mvps) {
    const s = state.get(mvp.playerId);
    if (!s) continue;
    s.points += POINTS.mvp;
    s.mvpCount += 1;
  }

  return { players: state, matches: matchSnapshots };
}

/** Son N maçtaki kazanma yüzdesi (Playtomic'teki "Efektivite"). */
export function efficiency(history: PlayerMatchRating[], lastN: number): number {
  const recent = history.slice(-lastN);
  if (recent.length === 0) return 0;
  return (recent.filter((h) => h.won).length / recent.length) * 100;
}

export function formatLevel(value: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDelta(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  return `${sign}${formatLevel(Math.abs(rounded))}`;
}

/**
 * Admin bir oyuncunun GÜNCEL seviyesini elle belirlemek istediğinde, maç geçmişi yeniden
 * oynatıldığında o seviyeye ulaşacak başlangıç seviyesini bulur (ikiye bölme yöntemi).
 * Güncel seviye başlangıç seviyesiyle birlikte artar, bu yüzden arama güvenlidir.
 */
export function solveBaseLevel(
  players: RatingPlayerInput[],
  matches: RatingMatchInput[],
  playerId: string,
  targetRating: number
): { baseLevel: number; resultingRating: number } {
  const target = clampRating(targetRating);
  const ratingFor = (base: number) =>
    runRatingEngine(
      players.map((p) => (p.id === playerId ? { ...p, baseLevel: base } : p)),
      matches
    ).players.get(playerId)?.rating ?? base;

  let lo = RATING_MIN;
  let hi = RATING_MAX;
  if (ratingFor(lo) >= target) return { baseLevel: lo, resultingRating: ratingFor(lo) };
  if (ratingFor(hi) <= target) return { baseLevel: hi, resultingRating: ratingFor(hi) };
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ratingFor(mid) < target) lo = mid;
    else hi = mid;
  }
  const baseLevel = Math.round(((lo + hi) / 2) * 1000) / 1000;
  return { baseLevel, resultingRating: ratingFor(baseLevel) };
}
