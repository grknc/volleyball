export type SetScore = [number, number];

export interface MatchResult {
  setsWonA: number;
  setsWonB: number;
  winner: 'A' | 'B';
  pointsA: number;
  pointsB: number;
}

export function computeMatchResult(sets: SetScore[]): MatchResult {
  if (sets.length < 2 || sets.length > 3) {
    throw new Error('Bir maç 2 veya 3 setten oluşmalı');
  }

  let setsWonA = 0;
  let setsWonB = 0;
  for (const [a, b] of sets) {
    if (a === b) throw new Error('Bir set berabere bitemez');
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
