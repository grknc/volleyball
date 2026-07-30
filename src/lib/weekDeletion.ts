import { isCompletedMatch, type MatchLike } from './matchScoring';

export function canDeleteWeek(matches: MatchLike[]): boolean {
  return !matches.some((match) => isCompletedMatch(match));
}
