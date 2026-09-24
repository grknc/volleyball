/**
 * Pozisyon + seviye dengeli takım kurucu.
 *
 * 1. Takım boyutları eşitlenir (en fazla 1 kişi fark).
 * 2. Kilit pozisyonlar (Pasör → Orta Oyuncu → Libero) önce ve takımlara eşit dağıtılır.
 * 3. Kalan oyuncular (Smaçör, Çaprazcı, pozisyonu olmayanlar) en düşük toplam seviyeli takıma verilir.
 * 4. Son olarak aynı roldeki oyuncular takımlar arasında takas edilerek seviye farkı en aza indirilir
 *    (takas pozisyon dağılımını hiç bozmaz).
 */

export interface PlayerInput {
  id: string;
  name: string;
  level: number;
  position?: string | null;
}

export interface BalancedTeam {
  name: string;
  players: PlayerInput[];
}

export interface BalanceOptions {
  /** 0 = her zaman aynı sonuç. >0 ise seviyelere bu genişlikte rastgele gürültü eklenir ("Başka öner"). */
  variation?: number;
  random?: () => number;
}

export type TeamRole = 'Pasör' | 'Orta Oyuncu' | 'Libero' | 'Hücum' | 'Belirsiz';

export const KEY_ROLES: TeamRole[] = ['Pasör', 'Orta Oyuncu', 'Libero'];
const ROLE_ORDER: TeamRole[] = ['Pasör', 'Orta Oyuncu', 'Hücum', 'Libero', 'Belirsiz'];

export function roleOf(position: string | null | undefined): TeamRole {
  if (position === 'Pasör' || position === 'Orta Oyuncu' || position === 'Libero') return position;
  if (position === 'Smaçör' || position === 'Çaprazcı') return 'Hücum';
  return 'Belirsiz';
}

/** Takas edilebilir rol grubu: kilit roller kendi içinde, diğerleri birbiriyle. */
function swapGroup(role: TeamRole): string {
  return KEY_ROLES.includes(role) ? role : 'flex';
}

function teamSum(team: PlayerInput[]): number {
  return team.reduce((s, p) => s + p.level, 0);
}

function spread(teams: PlayerInput[][]): number {
  const sums = teams.map(teamSum);
  const mean = sums.reduce((s, v) => s + v, 0) / sums.length;
  return sums.reduce((s, v) => s + (v - mean) ** 2, 0);
}

export function balanceTeams(
  players: PlayerInput[],
  teamCount: number,
  options: BalanceOptions = {}
): BalancedTeam[] {
  if (teamCount < 2) {
    throw new Error('En az 2 takım gerekli');
  }
  if (players.length < teamCount) {
    throw new Error('Takım sayısından daha az oyuncu var');
  }

  const random = options.random ?? Math.random;
  const variation = options.variation ?? 0;
  const noisy = new Map(players.map((p) => [p.id, p.level + (variation > 0 ? (random() - 0.5) * variation : 0)]));
  const byNoisyDesc = (a: PlayerInput, b: PlayerInput) =>
    noisy.get(b.id)! - noisy.get(a.id)! || a.name.localeCompare(b.name, 'tr');

  const base = Math.floor(players.length / teamCount);
  const extra = players.length % teamCount;
  const capacity = Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
  const teams: PlayerInput[][] = Array.from({ length: teamCount }, () => []);
  const noisySum = (i: number) => teams[i].reduce((s, p) => s + noisy.get(p.id)!, 0);
  const open = () => teams.map((_, i) => i).filter((i) => teams[i].length < capacity[i]);

  // 1-2) Kilit pozisyonlar
  for (const role of KEY_ROLES) {
    const group = players.filter((p) => roleOf(p.position) === role).sort(byNoisyDesc);
    for (const p of group) {
      const candidates = open();
      candidates.sort((a, b) => {
        const ra = teams[a].filter((x) => roleOf(x.position) === role).length;
        const rb = teams[b].filter((x) => roleOf(x.position) === role).length;
        return ra - rb || noisySum(a) - noisySum(b) || teams[a].length - teams[b].length;
      });
      teams[candidates[0]].push(p);
    }
  }

  // 3) Kalanlar
  const rest = players.filter((p) => !KEY_ROLES.includes(roleOf(p.position))).sort(byNoisyDesc);
  for (const p of rest) {
    const candidates = open();
    candidates.sort((a, b) => noisySum(a) - noisySum(b) || teams[a].length - teams[b].length);
    teams[candidates[0]].push(p);
  }

  // 4) Aynı gruptaki oyuncuları takas ederek gerçek seviye farkını küçült
  for (let iter = 0; iter < 200; iter++) {
    const current = spread(teams);
    let best: { t1: number; i1: number; t2: number; i2: number; score: number } | null = null;
    for (let t1 = 0; t1 < teamCount; t1++) {
      for (let t2 = t1 + 1; t2 < teamCount; t2++) {
        for (let i1 = 0; i1 < teams[t1].length; i1++) {
          for (let i2 = 0; i2 < teams[t2].length; i2++) {
            const a = teams[t1][i1];
            const b = teams[t2][i2];
            if (swapGroup(roleOf(a.position)) !== swapGroup(roleOf(b.position))) continue;
            if (a.level === b.level) continue;
            teams[t1][i1] = b;
            teams[t2][i2] = a;
            const score = spread(teams);
            teams[t1][i1] = a;
            teams[t2][i2] = b;
            if (score < current - 1e-9 && (!best || score < best.score)) best = { t1, i1, t2, i2, score };
          }
        }
      }
    }
    if (!best) break;
    const tmp = teams[best.t1][best.i1];
    teams[best.t1][best.i1] = teams[best.t2][best.i2];
    teams[best.t2][best.i2] = tmp;
  }

  return teams.map((team, i) => ({
    name: `Takım ${String.fromCharCode(65 + i)}`,
    players: [...team].sort(
      (a, b) =>
        ROLE_ORDER.indexOf(roleOf(a.position)) - ROLE_ORDER.indexOf(roleOf(b.position)) || b.level - a.level
    ),
  }));
}

export interface TeamSummary {
  size: number;
  levelSum: number;
  levelAvg: number;
  roles: Record<TeamRole, number>;
  warnings: string[];
}

export function summarizeTeam(players: PlayerInput[]): TeamSummary {
  const roles: Record<TeamRole, number> = { Pasör: 0, 'Orta Oyuncu': 0, Libero: 0, Hücum: 0, Belirsiz: 0 };
  for (const p of players) roles[roleOf(p.position)] += 1;
  const levelSum = teamSum(players);
  const warnings: string[] = [];
  if (players.length > 0 && roles['Pasör'] === 0) warnings.push('Pasör yok');
  if (players.length >= 4 && roles['Orta Oyuncu'] === 0) warnings.push('Orta oyuncu yok');
  if (roles['Pasör'] > 1 && players.length <= 4) warnings.push(`${roles['Pasör']} pasör var`);
  return {
    size: players.length,
    levelSum,
    levelAvg: players.length ? levelSum / players.length : 0,
    roles,
    warnings,
  };
}

/** Katılımcı sayısına göre uygun formatlar: az yedekli ve büyük takımlı olanlar önce. */
export interface FormatOption {
  teamSize: number;
  teamCount: number;
  bench: number;
  label: string;
}

export function suggestFormats(playerCount: number, limit = 3): FormatOption[] {
  const options: FormatOption[] = [];
  for (const teamSize of [6, 5, 4, 3, 2]) {
    const teamCount = Math.floor(playerCount / teamSize);
    if (teamCount < 2) continue;
    const bench = playerCount - teamCount * teamSize;
    options.push({
      teamSize,
      teamCount,
      bench,
      label: `${teamCount} takım × ${teamSize}x${teamSize}${bench > 0 ? ` (+${bench} yedek)` : ''}`,
    });
  }
  return options
    .sort((a, b) => a.bench - b.bench || b.teamSize - a.teamSize)
    .slice(0, limit);
}
