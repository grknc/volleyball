import { describe, expect, it } from 'vitest';
import { findBiggestBlowout, findClosestMatch, findHighestScoringMatch, type MatchRecordInput } from './matchRecords';

const blowout: MatchRecordInput = {
  matchId: 'blowout',
  weekId: 'week-1',
  weekDate: new Date('2026-01-01'),
  teamAName: 'Takım A',
  teamBName: 'Takım B',
  sets: [
    [25, 5],
    [25, 8],
  ],
};

const close: MatchRecordInput = {
  matchId: 'close',
  weekId: 'week-1',
  weekDate: new Date('2026-01-01'),
  teamAName: 'Takım C',
  teamBName: 'Takım D',
  sets: [
    [25, 23],
    [23, 25],
    [16, 14],
  ],
};

const highScoring: MatchRecordInput = {
  matchId: 'highscoring',
  weekId: 'week-1',
  weekDate: new Date('2026-01-01'),
  teamAName: 'Takım E',
  teamBName: 'Takım F',
  sets: [
    [30, 28],
    [29, 31],
    [20, 18],
  ],
};

describe('match record finders', () => {
  it('returns null for an empty list', () => {
    expect(findBiggestBlowout([])).toBeNull();
    expect(findClosestMatch([])).toBeNull();
    expect(findHighestScoringMatch([])).toBeNull();
  });

  it('finds the match with the largest total point difference', () => {
    const result = findBiggestBlowout([blowout, close, highScoring]);
    expect(result?.matchId).toBe('blowout');
  });

  it('finds the match with the smallest total point difference', () => {
    const result = findClosestMatch([blowout, close, highScoring]);
    expect(result?.matchId).toBe('close');
  });

  it('finds the match with the highest total combined points', () => {
    const result = findHighestScoringMatch([blowout, close, highScoring]);
    expect(result?.matchId).toBe('highscoring');
  });

  it('reports the correct winner and loser names', () => {
    const result = findBiggestBlowout([blowout]);
    expect(result?.winnerName).toBe('Takım A');
    expect(result?.loserName).toBe('Takım B');
  });
});
