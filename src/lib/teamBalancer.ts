export interface PlayerInput {
  id: string;
  name: string;
  level: number;
}

export interface BalancedTeam {
  name: string;
  players: PlayerInput[];
}

export function balanceTeams(players: PlayerInput[], teamCount: number): BalancedTeam[] {
  if (teamCount < 2) {
    throw new Error('En az 2 takım gerekli');
  }
  if (players.length < teamCount) {
    throw new Error('Takım sayısından daha az oyuncu var');
  }

  const sorted = [...players].sort((a, b) => b.level - a.level);
  const teams: BalancedTeam[] = Array.from({ length: teamCount }, (_, i) => ({
    name: `Takım ${String.fromCharCode(65 + i)}`,
    players: [],
  }));

  let index = 0;
  let round = 0;
  while (index < sorted.length) {
    const forward = round % 2 === 0;
    for (let step = 0; step < teamCount && index < sorted.length; step++) {
      const teamIndex = forward ? step : teamCount - 1 - step;
      teams[teamIndex].players.push(sorted[index]);
      index++;
    }
    round++;
  }

  return teams;
}
