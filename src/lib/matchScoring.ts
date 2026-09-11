export type SetScore = [number, number];

export interface MatchResult {
  setsWonA: number;
  setsWonB: number;
  winner: 'A' | 'B';
  pointsA: number;
  pointsB: number;
}

export function computeMatchResult(sets: SetScore[], targetPoints?: number): MatchResult {
  if (sets.length < 2 || sets.length > 3) {
    throw new Error('Bir maç 2 veya 3 setten oluşmalı');
  }

  let setsWonA = 0;
  let setsWonB = 0;
  for (const [a, b] of sets) {
    if (a === b) throw new Error('Bir set berabere bitemez');
    if (targetPoints !== undefined) {
      const winnerScore = Math.max(a, b);
      const loserScore = Math.min(a, b);
      if (winnerScore < targetPoints) {
        throw new Error(`Bir set, kazanan takım en az ${targetPoints} sayıya ulaşmadan bitemez`);
      }
      if (winnerScore - loserScore < 2) {
        throw new Error('Bir set, kazanan takım en az 2 sayı farkla önde bitmeli');
      }
    }
    if (a > b) setsWonA++; else setsWonB++;
  }

  if (Math.max(setsWonA, setsWonB) !== 2) {
    throw new Error('Maç, bir takımın 2 set kazanmasıyla bitmeli');
  }

  const winner: 'A' | 'B' = setsWonA === 2 ? 'A' : 'B';
  const isSweep = sets.length === 2;
  const winnerPoints = isSweep ? 3 : 2;

  return {
    setsWonA,
    setsWonB,
    winner,
    pointsA: winner === 'A' ? winnerPoints : 0,
    pointsB: winner === 'B' ? winnerPoints : 0,
  };
}

export interface MatchLike {
  sets: SetScore[];
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; // Match.status does not exist in the DB yet; when it's added, wire it through here and every caller of isCompletedMatch benefits automatically.
}

export function isCompletedMatch(match: MatchLike, targetPoints?: number): boolean {
  if (match.status) {
    return match.status === 'COMPLETED';
  }
  if (match.sets.length < 2) return false;
  try {
    computeMatchResult(match.sets, targetPoints);
    return true;
  } catch {
    return false;
  }
}
