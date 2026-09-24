import { computeMatchResult } from './matchScoring';
import { efficiency, reliabilityLabel } from './rating';
import type { RatingSnapshot } from './ratingService';

export interface ProfilePlayerChip {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Maç öncesi seviye */
  level: number;
  delta: number;
}

export interface ProfileMatchSide {
  teamId: string;
  teamName: string;
  players: ProfilePlayerChip[];
  sets: number[];
  won: boolean;
}

export interface ProfileMatchCard {
  matchId: string;
  weekId: string;
  weekDate: string;
  format: string;
  won: boolean;
  sweep: boolean;
  before: number;
  after: number;
  delta: number;
  expected: number;
  pointsEarned: number;
  mine: ProfileMatchSide;
  opponent: ProfileMatchSide;
}

export interface Companion {
  playerId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  matches: number;
  wins: number;
}

export interface FormatStat {
  format: string;
  matches: number;
  wins: number;
}

export interface PlayerRatingProfile {
  rating: number;
  baseLevel: number;
  peakRating: number;
  reliability: number;
  reliabilityLabel: string;
  points: number;
  rank: number | null;
  rankedTotal: number;
  matches: number;
  wins: number;
  losses: number;
  efficiencyLast6: number;
  last6Wins: number;
  last6Count: number;
  levelHistory: Array<{ matchId: string; date: string; level: number; delta: number; won: boolean }>;
  cards: ProfileMatchCard[];
  partners: Companion[];
  opponents: Companion[];
  formats: FormatStat[];
}

const COMPANION_LIMIT = 10;

export function buildPlayerRatingProfile(snapshot: RatingSnapshot, playerId: string): PlayerRatingProfile | null {
  const state = snapshot.players.get(playerId);
  const info = snapshot.playersById.get(playerId);
  if (!state || !info) return null;

  const currentLevel = (id: string) =>
    snapshot.players.get(id)?.rating ?? snapshot.playersById.get(id)?.baseLevel ?? 5;

  const partners = new Map<string, Companion>();
  const opponents = new Map<string, Companion>();
  const formats = new Map<string, FormatStat>();

  const bump = (map: Map<string, Companion>, id: string, won: boolean) => {
    const p = snapshot.playersById.get(id);
    if (!p) return;
    const c =
      map.get(id) ??
      ({ playerId: id, name: p.name, avatarUrl: p.avatarUrl, level: currentLevel(id), matches: 0, wins: 0 } as Companion);
    c.matches += 1;
    if (won) c.wins += 1;
    map.set(id, c);
  };

  const cards: ProfileMatchCard[] = [];

  for (const h of state.history) {
    const match = snapshot.matchesById.get(h.matchId);
    const snap = snapshot.matches.get(h.matchId);
    if (!match || !snap) continue;

    const iAmA = h.teamId === match.teamA.id;
    const mineTeam = iAmA ? match.teamA : match.teamB;
    const oppTeam = iAmA ? match.teamB : match.teamA;
    const byPlayer = new Map(snap.players.map((p) => [p.playerId, p]));

    const chips = (ids: string[]): ProfilePlayerChip[] =>
      ids
        .filter((id) => byPlayer.has(id))
        .map((id) => {
          const r = byPlayer.get(id)!;
          const p = snapshot.playersById.get(id);
          return { id, name: p?.name ?? '?', avatarUrl: p?.avatarUrl ?? null, level: r.before, delta: r.delta };
        })
        // Profil sahibi kendi takımında hep ilk sırada
        .sort((a, b) => (a.id === playerId ? -1 : b.id === playerId ? 1 : b.level - a.level));

    const result = computeMatchResult(match.sets);
    const mySets = match.sets.map(([a, b]) => (iAmA ? a : b));
    const oppSets = match.sets.map(([a, b]) => (iAmA ? b : a));

    cards.push({
      matchId: h.matchId,
      weekId: h.weekId,
      weekDate: h.weekDate.toISOString(),
      format: h.format,
      won: h.won,
      sweep: h.sweep,
      before: h.before,
      after: h.after,
      delta: h.delta,
      expected: h.expected,
      pointsEarned: h.pointsEarned,
      mine: {
        teamId: mineTeam.id,
        teamName: mineTeam.name,
        players: chips(mineTeam.playerIds),
        sets: mySets,
        won: (result.winner === 'A') === iAmA,
      },
      opponent: {
        teamId: oppTeam.id,
        teamName: oppTeam.name,
        players: chips(oppTeam.playerIds),
        sets: oppSets,
        won: (result.winner === 'A') !== iAmA,
      },
    });

    for (const id of mineTeam.playerIds) if (id !== playerId && byPlayer.has(id)) bump(partners, id, h.won);
    for (const id of oppTeam.playerIds) if (byPlayer.has(id)) bump(opponents, id, h.won);

    const f = formats.get(h.format) ?? { format: h.format, matches: 0, wins: 0 };
    f.matches += 1;
    if (h.won) f.wins += 1;
    formats.set(h.format, f);
  }

  const sortCompanions = (map: Map<string, Companion>) =>
    Array.from(map.values())
      .sort((a, b) => b.matches - a.matches || b.wins - a.wins || a.name.localeCompare(b.name, 'tr'))
      .slice(0, COMPANION_LIMIT);

  const wins = state.history.filter((h) => h.won).length;
  const last6 = state.history.slice(-6);
  const rankIndex = snapshot.ranking.indexOf(playerId);

  return {
    rating: state.rating,
    baseLevel: state.baseLevel,
    peakRating: state.peakRating,
    reliability: state.reliability,
    reliabilityLabel: reliabilityLabel(state.reliability),
    points: state.points,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    rankedTotal: snapshot.ranking.length,
    matches: state.matches,
    wins,
    losses: state.matches - wins,
    efficiencyLast6: efficiency(state.history, 6),
    last6Wins: last6.filter((h) => h.won).length,
    last6Count: last6.length,
    levelHistory: state.history.map((h) => ({
      matchId: h.matchId,
      date: h.weekDate.toISOString(),
      level: h.after,
      delta: h.delta,
      won: h.won,
    })),
    cards: cards.reverse(),
    partners: sortCompanions(partners),
    opponents: sortCompanions(opponents),
    formats: Array.from(formats.values()).sort((a, b) => a.format.localeCompare(b.format)),
  };
}
