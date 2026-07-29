# Haftalık Voleybol Organizasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app where an admin manages a player database, forms weekly level-balanced teams, records set-score match results, and publishes a public Mackolik-style page (standings, results, "haftanın oyuncusu") for each week, plus an archive of past weeks.

**Architecture:** Single Next.js (App Router, TypeScript) project serving both the admin panel (`/admin/*`, cookie-session protected) and public pages (`/`, `/hafta/[id]`, `/arsiv`). PostgreSQL via Prisma ORM. Pure business logic (match scoring, team balancing, standings) lives in dependency-free `src/lib/*` modules covered by Vitest unit tests; everything that touches the database or the browser is verified manually against a running dev server.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), Tailwind CSS, PostgreSQL, Prisma ORM, `jose` (JWT) + `bcryptjs` (password hashing) for a single-admin auth scheme, Vitest for unit tests, deployed on Vercel with a Neon Postgres database.

## Global Constraints

- Next.js 14+ App Router, TypeScript strict mode, Node.js 18+, npm as package manager.
- PostgreSQL only, accessed exclusively through Prisma (`src/lib/db.ts` singleton) — no raw SQL.
- Required env vars (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`.
- All UI copy is in Turkish.
- Styling via Tailwind CSS utility classes only — no separate CSS files beyond `globals.css`.
- Scoring rule (from spec, verbatim): a match won 2-0 awards the winner 3 points; won 2-1 awards the winner 2 points; the loser always gets 0 points.
- Standings are computed per week only — there is no season-long point table. Sort order: points desc, then set difference desc.
- No player login/accounts — single admin only. No automatic MVP calculation — "haftanın oyuncusu" is always a manual admin pick.
- Test strategy: `src/lib/matchScoring.ts`, `src/lib/teamBalancer.ts`, `src/lib/standings.ts`, `src/lib/auth.ts` are pure/dependency-free and get full Vitest unit-test coverage (red → green per task). Anything that touches Prisma/DB, an API route, or a page is verified manually against `npm run dev` (curl for JSON endpoints, browser for pages) — there is no automated integration/E2E suite in this plan.

---

## Task 1: Proje İskeleti (Next.js + TypeScript + Tailwind + Vitest)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `next-env.d.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js dev server on `http://localhost:3000` serving a placeholder home page; `npm run test` (Vitest) and `npm run build` both work, ready for later tasks to add real code.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "voleybol",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.18.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.6.3"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/bcryptjs": "^2.4.6",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "prisma": "^5.18.0",
    "vitest": "^2.0.0",
    "tsx": "^4.16.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`, `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.mjs`**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

`postcss.config.mjs`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write `.gitignore` and `.env.example`**

`.gitignore`:
```
node_modules
.next
.env
.env.local
```

`.env.example`:
```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="generate-a-long-random-string"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD_HASH="bcrypt-hash-here"
```

- [ ] **Step 6: Write `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Haftalık Voleybol',
  description: 'Haftalık voleybol organizasyonu sonuçları ve puan durumu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-slate-50 text-slate-900 min-h-screen">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (placeholder — replaced in Task 14):
```tsx
export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Haftalık Voleybol</h1>
      <p className="mt-2 text-slate-600">Yakında burada haftalık sonuçlar olacak.</p>
    </main>
  );
}
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 8: Verify dev server and build**

Run: `npm run dev` (in background/separate terminal), then `curl -s http://localhost:3000` — expected: HTML containing `Haftalık Voleybol`. Stop the dev server.
Run: `npm run build` — expected: exits 0, prints a route summary including `/`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs next-env.d.ts tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore .env.example src
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind + Vitest project"
```

---

## Task 2: Prisma Şeması + PostgreSQL Migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/smoke-test.ts`
- Create: `src/lib/db.ts`
- Modify: `.env` (local only, gitignored — not committed)

**Interfaces:**
- Produces: `prisma` (Prisma Client singleton) from `@/lib/db`, and the full data model (`Player`, `Week`, `WeekAttendee`, `Team`, `TeamPlayer`, `Match`, `WeeklyMvp`) that every later task's API routes and pages read/write.

> **⚠️ Kullanıcı girdisi gerekli:** Bu adımdan önce ücretsiz bir PostgreSQL veritabanı gerekiyor (ör. https://neon.tech üzerinde bir proje oluştur) ve bağlantı dizesini `.env` dosyasına `DATABASE_URL` olarak ekle. `.env.example` dosyası şablon olarak kullanılabilir; `.env` gitignore'da olduğu için commit'lenmez.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Player {
  id              String         @id @default(cuid())
  name            String
  level           Int
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  teamPlayers     TeamPlayer[]
  weekAttendances WeekAttendee[]
  mvps            WeeklyMvp[]
}

model Week {
  id        String         @id @default(cuid())
  date      DateTime
  createdAt DateTime       @default(now())
  attendees WeekAttendee[]
  teams     Team[]
  matches   Match[]
  mvps      WeeklyMvp[]
}

model WeekAttendee {
  id       String @id @default(cuid())
  weekId   String
  playerId String
  week     Week   @relation(fields: [weekId], references: [id], onDelete: Cascade)
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([weekId, playerId])
}

model Team {
  id          String       @id @default(cuid())
  weekId      String
  name        String
  week        Week         @relation(fields: [weekId], references: [id], onDelete: Cascade)
  players     TeamPlayer[]
  homeMatches Match[]      @relation("MatchTeamA")
  awayMatches Match[]      @relation("MatchTeamB")
}

model TeamPlayer {
  id       String @id @default(cuid())
  teamId   String
  playerId String
  team     Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([teamId, playerId])
}

model Match {
  id        String   @id @default(cuid())
  weekId    String
  teamAId   String
  teamBId   String
  sets      Json
  createdAt DateTime @default(now())
  week      Week     @relation(fields: [weekId], references: [id], onDelete: Cascade)
  teamA     Team     @relation("MatchTeamA", fields: [teamAId], references: [id], onDelete: Cascade)
  teamB     Team     @relation("MatchTeamB", fields: [teamBId], references: [id], onDelete: Cascade)
}

model WeeklyMvp {
  id       String @id @default(cuid())
  weekId   String
  playerId String
  week     Week   @relation(fields: [weekId], references: [id], onDelete: Cascade)
  player   Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([weekId, playerId])
}
```

- [ ] **Step 2: Write `src/lib/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: creates `prisma/migrations/<timestamp>_init/`, prints "Your database is now in sync with your schema." and generates the Prisma Client.

- [ ] **Step 4: Write `prisma/smoke-test.ts`**

```ts
import { prisma } from '../src/lib/db';

async function main() {
  const player = await prisma.player.create({ data: { name: 'Test Oyuncu', level: 5 } });
  const found = await prisma.player.findUnique({ where: { id: player.id } });
  if (!found || found.name !== 'Test Oyuncu') {
    throw new Error('Smoke test failed: player not found or mismatched');
  }
  await prisma.player.delete({ where: { id: player.id } });
  console.log('OK: Prisma + PostgreSQL bağlantısı çalışıyor');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: Run the smoke test**

Run: `npx tsx prisma/smoke-test.ts`
Expected: prints `OK: Prisma + PostgreSQL bağlantısı çalışıyor` and exits 0.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/smoke-test.ts src/lib/db.ts .env.example
git commit -m "feat: add Prisma schema and PostgreSQL migration"
```

---

## Task 3: `lib/matchScoring.ts` — Set Skorundan Maç Sonucu Hesabı

**Files:**
- Create: `src/lib/matchScoring.ts`
- Test: `src/lib/matchScoring.test.ts`

**Interfaces:**
- Produces: `type SetScore = [number, number]`, `interface MatchResult { setsWonA, setsWonB, winner: 'A'|'B', pointsA, pointsB }`, `function computeMatchResult(sets: SetScore[]): MatchResult`. Consumed by Task 5 (`standings.ts`), Task 12 (match score API + `FixtureManager`), and Task 14 (`weekView.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/matchScoring.test.ts
import { describe, it, expect } from 'vitest';
import { computeMatchResult } from './matchScoring';

describe('computeMatchResult', () => {
  it('awards 3 points for a 2-0 sweep', () => {
    const result = computeMatchResult([[25, 20], [25, 18]]);
    expect(result).toEqual({ setsWonA: 2, setsWonB: 0, winner: 'A', pointsA: 3, pointsB: 0 });
  });

  it('awards 2 points for a 2-1 win', () => {
    const result = computeMatchResult([[25, 20], [20, 25], [15, 10]]);
    expect(result).toEqual({ setsWonA: 2, setsWonB: 1, winner: 'A', pointsA: 2, pointsB: 0 });
  });

  it('lets team B win 2-1', () => {
    const result = computeMatchResult([[20, 25], [25, 22], [10, 15]]);
    expect(result).toEqual({ setsWonA: 1, setsWonB: 2, winner: 'B', pointsA: 0, pointsB: 2 });
  });

  it('throws when a set ends in a tie', () => {
    expect(() => computeMatchResult([[25, 25], [25, 20]])).toThrow();
  });

  it('throws when there are fewer than 2 sets', () => {
    expect(() => computeMatchResult([[25, 20]])).toThrow();
  });

  it('throws when there are more than 3 sets', () => {
    expect(() =>
      computeMatchResult([[25, 20], [20, 25], [25, 20], [25, 20]]),
    ).toThrow();
  });

  it('throws when a team sweeps all 3 sets in a best-of-3 (invalid input)', () => {
    expect(() => computeMatchResult([[25, 20], [25, 18], [25, 15]])).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/matchScoring.test.ts`
Expected: FAIL — `Cannot find module './matchScoring'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/matchScoring.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/matchScoring.test.ts`
Expected: PASS — 7/7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchScoring.ts src/lib/matchScoring.test.ts
git commit -m "feat: add match scoring logic (set scores -> winner + points)"
```

---

## Task 4: `lib/teamBalancer.ts` — Seviyeye Göre Dengeli Takım Önerisi

**Files:**
- Create: `src/lib/teamBalancer.ts`
- Test: `src/lib/teamBalancer.test.ts`

**Interfaces:**
- Produces: `interface PlayerInput { id, name, level }`, `interface BalancedTeam { name, players: PlayerInput[] }`, `function balanceTeams(players: PlayerInput[], teamCount: number): BalancedTeam[]`. Consumed by Task 10 (`teams/suggest` API route).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/teamBalancer.test.ts
import { describe, it, expect } from 'vitest';
import { balanceTeams } from './teamBalancer';

describe('balanceTeams', () => {
  it('splits 8 players into 2 level-balanced teams via snake draft', () => {
    const players = [
      { id: '1', name: 'A', level: 10 },
      { id: '2', name: 'B', level: 9 },
      { id: '3', name: 'C', level: 8 },
      { id: '4', name: 'D', level: 7 },
      { id: '5', name: 'E', level: 6 },
      { id: '6', name: 'F', level: 5 },
      { id: '7', name: 'G', level: 4 },
      { id: '8', name: 'H', level: 3 },
    ];
    const teams = balanceTeams(players, 2);
    expect(teams).toHaveLength(2);
    const levelSum = (team: (typeof teams)[number]) =>
      team.players.reduce((sum, p) => sum + p.level, 0);
    expect(levelSum(teams[0])).toBe(26);
    expect(levelSum(teams[1])).toBe(26);
    expect(teams[0].players.map((p) => p.id)).toEqual(['1', '4', '5', '8']);
    expect(teams[1].players.map((p) => p.id)).toEqual(['2', '3', '6', '7']);
  });

  it('throws when there are fewer players than requested teams', () => {
    const players = [{ id: '1', name: 'A', level: 5 }];
    expect(() => balanceTeams(players, 2)).toThrow();
  });

  it('throws when fewer than 2 teams are requested', () => {
    const players = [
      { id: '1', name: 'A', level: 5 },
      { id: '2', name: 'B', level: 4 },
    ];
    expect(() => balanceTeams(players, 1)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/teamBalancer.test.ts`
Expected: FAIL — `Cannot find module './teamBalancer'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/teamBalancer.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/teamBalancer.test.ts`
Expected: PASS — 3/3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamBalancer.ts src/lib/teamBalancer.test.ts
git commit -m "feat: add snake-draft team balancer"
```

---

## Task 5: `lib/standings.ts` — Haftalık Puan Durumu

**Files:**
- Create: `src/lib/standings.ts`
- Test: `src/lib/standings.test.ts`

**Interfaces:**
- Consumes: `computeMatchResult` from `@/lib/matchScoring` (Task 3).
- Produces: `interface StandingsRow { teamId, teamName, played, won, lost, points, setsFor, setsAgainst, setDiff }`, `function computeStandings(input: { teams: {id,name}[], matches: {teamAId,teamBId,sets}[] }): StandingsRow[]`. Consumed by Task 14 (`weekView.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/standings.test.ts
import { describe, it, expect } from 'vitest';
import { computeStandings } from './standings';

describe('computeStandings', () => {
  const teams = [
    { id: 't1', name: 'Takım A' },
    { id: 't2', name: 'Takım B' },
    { id: 't3', name: 'Takım C' },
  ];

  it('ranks teams by points, then by set difference', () => {
    const matches = [
      { teamAId: 't1', teamBId: 't2', sets: [[25, 20], [25, 18]] as [number, number][] },
      { teamAId: 't1', teamBId: 't3', sets: [[25, 20], [20, 25], [15, 10]] as [number, number][] },
      { teamAId: 't2', teamBId: 't3', sets: [[20, 25], [22, 25]] as [number, number][] },
    ];
    const standings = computeStandings({ teams, matches });

    expect(standings.map((r) => r.teamId)).toEqual(['t1', 't3', 't2']);
    expect(standings[0]).toMatchObject({ teamId: 't1', played: 2, won: 2, lost: 0, points: 5 });
    expect(standings[1]).toMatchObject({ teamId: 't3', played: 2, won: 1, lost: 1, points: 3 });
    expect(standings[2]).toMatchObject({ teamId: 't2', played: 2, won: 0, lost: 2, points: 0 });
  });

  it('returns a zeroed row for a team with no matches yet', () => {
    const standings = computeStandings({ teams, matches: [] });
    expect(standings).toHaveLength(3);
    expect(standings.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/standings.test.ts`
Expected: FAIL — `Cannot find module './standings'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/standings.ts
import { computeMatchResult, type SetScore } from './matchScoring';

export interface StandingsTeam {
  id: string;
  name: string;
}

export interface StandingsMatch {
  teamAId: string;
  teamBId: string;
  sets: SetScore[];
}

export interface StandingsInput {
  teams: StandingsTeam[];
  matches: StandingsMatch[];
}

export interface StandingsRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  setDiff: number;
}

export function computeStandings({ teams, matches }: StandingsInput): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const team of teams) {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsFor: 0,
      setsAgainst: 0,
      setDiff: 0,
    });
  }

  for (const match of matches) {
    const rowA = rows.get(match.teamAId);
    const rowB = rows.get(match.teamBId);
    if (!rowA || !rowB) {
      throw new Error('Maç, tabloda olmayan bir takıma referans veriyor');
    }
    const result = computeMatchResult(match.sets);

    rowA.played++;
    rowB.played++;
    rowA.setsFor += result.setsWonA;
    rowA.setsAgainst += result.setsWonB;
    rowB.setsFor += result.setsWonB;
    rowB.setsAgainst += result.setsWonA;
    rowA.points += result.pointsA;
    rowB.points += result.pointsB;

    if (result.winner === 'A') {
      rowA.won++;
      rowB.lost++;
    } else {
      rowB.won++;
      rowA.lost++;
    }
  }

  for (const row of rows.values()) {
    row.setDiff = row.setsFor - row.setsAgainst;
  }

  return Array.from(rows.values()).sort((a, b) => b.points - a.points || b.setDiff - a.setDiff);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/standings.test.ts`
Expected: PASS — 2/2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/standings.ts src/lib/standings.test.ts
git commit -m "feat: add weekly standings computation"
```

---

## Task 6: `lib/auth.ts` — Admin Oturum ve Kimlik Doğrulama Mantığı

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

**Interfaces:**
- Produces: `const SESSION_COOKIE: string`, `function createSessionToken(): Promise<string>`, `function verifySessionToken(token: string): Promise<boolean>`, `function verifyCredentials(email: string, password: string): boolean`. Consumed by Task 7 (login/logout routes, middleware).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/auth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { createSessionToken, verifySessionToken, verifyCredentials } from './auth';

describe('auth', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'test-secret-value-1234567890');
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
    vi.stubEnv('ADMIN_PASSWORD_HASH', bcrypt.hashSync('correct-password', 10));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates and verifies a valid session token', async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it('rejects a garbage token', async () => {
    expect(await verifySessionToken('not-a-real-token')).toBe(false);
  });

  it('accepts correct admin credentials', () => {
    expect(verifyCredentials('admin@example.com', 'correct-password')).toBe(true);
  });

  it('rejects wrong password', () => {
    expect(verifyCredentials('admin@example.com', 'wrong-password')).toBe(false);
  });

  it('rejects wrong email', () => {
    expect(verifyCredentials('someone@else.com', 'correct-password')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export const SESSION_COOKIE = 'volleybol_session';
const ALG = 'HS256';

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET ortam değişkeni tanımlı değil');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !adminPasswordHash) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD_HASH ortam değişkenleri tanımlı değil');
  }
  if (email !== adminEmail) return false;
  return bcrypt.compareSync(password, adminPasswordHash);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS — 5/5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: add admin session token + credential verification"
```

---

## Task 7: Admin Girişi (Login Sayfası, API, Middleware Koruması)

**Files:**
- Create: `src/app/api/login/route.ts`
- Create: `src/app/api/logout/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`
- Create: `src/components/LogoutButton.tsx`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createSessionToken`, `verifySessionToken`, `verifyCredentials`, `SESSION_COOKIE` from `@/lib/auth` (Task 6).
- Produces: cookie-protected `/admin/*` pages and `/api/admin/*` routes (used by every later admin task).

> **⚠️ Kullanıcı girdisi gerekli:** Bir admin şifresi seç, ardından `.env` dosyasına şu değerleri ekle:
> - `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` çıktısı
> - `ADMIN_EMAIL`: kendi e-posta adresin
> - `ADMIN_PASSWORD_HASH`: `node -e "console.log(require('bcryptjs').hashSync('SEÇTİĞİN_ŞİFRE', 10))"` çıktısı

- [ ] **Step 1: Write `src/app/api/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
  }
  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'Hatalı e-posta veya şifre' }, { status: 401 });
  }
  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
```

- [ ] **Step 2: Write `src/app/api/logout/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
```

- [ ] **Step 3: Write `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySessionToken(token) : false;
  if (valid) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
```

- [ ] **Step 4: Write `src/app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Giriş başarısız');
      return;
    }
    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto mt-24 p-6">
      <h1 className="text-xl font-bold mb-4">Yönetici Girişi</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-2">
          Giriş Yap
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Write `src/components/LogoutButton.tsx`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`**

```tsx
// src/components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <button onClick={handleLogout} className="text-sm underline">
      Çıkış Yap
    </button>
  );
}
```

```tsx
// src/app/admin/layout.tsx
import { LogoutButton } from '@/components/LogoutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="bg-slate-900 text-white px-6 py-3 flex gap-4 items-center">
        <span className="font-bold">Yönetim Paneli</span>
        <a href="/admin/oyuncular" className="hover:underline">Oyuncular</a>
        <a href="/admin/haftalar" className="hover:underline">Haftalar</a>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
      <div className="p-6">{children}</div>
    </div>
  );
}
```

```tsx
// src/app/admin/page.tsx
export default function AdminHome() {
  return (
    <div>
      <h1 className="text-xl font-bold">Hoş geldin</h1>
      <p className="text-slate-600 mt-2">Sol menüden oyuncuları veya haftaları yönetebilirsin.</p>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, then in another terminal:

1. `curl -i http://localhost:3000/admin` → expected: `307`/`308` redirect to `/login`.
2. `curl -i http://localhost:3000/api/admin/players` → expected: `401` with JSON `{"error":"Yetkisiz erişim"}` (route doesn't exist yet, but middleware intercepts before routing).
3. `curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"email\":\"wrong@x.com\",\"password\":\"wrong\"}"` → expected: `401`.
4. `curl -i -c cookies.txt -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"email\":\"<ADMIN_EMAIL>\",\"password\":\"<seçtiğin şifre>\"}"` → expected: `200` and a `Set-Cookie: volleybol_session=...` header, saved to `cookies.txt`.
5. `curl -i -b cookies.txt http://localhost:3000/admin` → expected: `200` with the admin page HTML.
6. Open `http://localhost:3000/login` in a browser, log in, confirm redirect to `/admin` showing "Hoş geldin" and a working "Çıkış Yap" button that sends you back to `/login`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/login src/app/api/logout src/app/login src/middleware.ts src/components/LogoutButton.tsx src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin login, session cookie, and route protection"
```

---

## Task 8: Admin — Oyuncu Yönetimi (CRUD)

**Files:**
- Create: `src/app/api/admin/players/route.ts`
- Create: `src/app/api/admin/players/[id]/route.ts`
- Create: `src/app/admin/oyuncular/page.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (Task 2).
- Produces: `GET/POST /api/admin/players`, `PATCH /api/admin/players/[id]` — the player list every later week/team task reads from.

- [ ] **Step 1: Write `src/app/api/admin/players/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json({ players });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, level } = body;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'İsim gerekli' }, { status: 400 });
  }
  if (typeof level !== 'number' || level < 1 || level > 10) {
    return NextResponse.json({ error: 'Seviye 1-10 arasında olmalı' }, { status: 400 });
  }
  const player = await prisma.player.create({ data: { name: name.trim(), level } });
  return NextResponse.json({ player }, { status: 201 });
}
```

- [ ] **Step 2: Write `src/app/api/admin/players/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const data: { name?: string; level?: number; isActive?: boolean } = {};

  if (typeof body.name === 'string' && body.name.trim().length > 0) {
    data.name = body.name.trim();
  }
  if (typeof body.level === 'number') {
    if (body.level < 1 || body.level > 10) {
      return NextResponse.json({ error: 'Seviye 1-10 arasında olmalı' }, { status: 400 });
    }
    data.level = body.level;
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
  }

  const player = await prisma.player.update({ where: { id: params.id }, data });
  return NextResponse.json({ player });
}
```

- [ ] **Step 3: Write `src/app/admin/oyuncular/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Player {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(5);
  const [error, setError] = useState<string | null>(null);

  async function loadPlayers() {
    const res = await fetch('/api/admin/players');
    const data = await res.json();
    setPlayers(data.players);
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, level }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Oyuncu eklenemedi');
      return;
    }
    setName('');
    setLevel(5);
    loadPlayers();
  }

  async function toggleActive(player: Player) {
    await fetch(`/api/admin/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !player.isActive }),
    });
    loadPlayers();
  }

  async function updateLevel(player: Player, newLevel: number) {
    await fetch(`/api/admin/players/${player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: newLevel }),
    });
    loadPlayers();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Oyuncular</h1>
      <form onSubmit={handleAdd} className="flex gap-2 mb-6 items-end">
        <div>
          <label className="block text-sm">İsim</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-sm">Seviye (1-10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20"
            required
          />
        </div>
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-1">
          Ekle
        </button>
      </form>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b">
            <th className="py-2">İsim</th>
            <th className="py-2">Seviye</th>
            <th className="py-2">Durum</th>
            <th className="py-2">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-b">
              <td className="py-2">{player.name}</td>
              <td className="py-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={player.level}
                  onBlur={(e) => updateLevel(player, Number(e.target.value))}
                  className="border rounded px-2 py-1 w-16"
                />
              </td>
              <td className="py-2">{player.isActive ? 'Aktif' : 'Pasif'}</td>
              <td className="py-2">
                <button onClick={() => toggleActive(player)} className="text-sm underline">
                  {player.isActive ? 'Pasife al' : 'Aktif yap'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, log in in the browser (from Task 7), then:

1. Open `http://localhost:3000/admin/oyuncular`. Add a player named "Deneme" with level 7 via the form. Confirm it appears in the table.
2. Change its level input to 9 and click away (blur) — confirm the value persists after a page refresh.
3. Click "Pasife al" — confirm the row now shows "Pasif", and clicking again shows "Aktif".
4. `curl -i -b cookies.txt -X POST http://localhost:3000/api/admin/players -H "Content-Type: application/json" -d "{\"name\":\"\",\"level\":5}"` → expected `400`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/players src/app/admin/oyuncular
git commit -m "feat: add player CRUD (admin API + page)"
```

---

## Task 9: Admin — Yeni Hafta Oluşturma

**Files:**
- Create: `src/app/api/admin/weeks/route.ts`
- Create: `src/app/api/admin/weeks/[id]/route.ts`
- Create: `src/app/admin/haftalar/page.tsx`
- Create: `src/app/admin/haftalar/yeni/page.tsx`
- Create: `src/app/admin/haftalar/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `GET /api/admin/players` (Task 8).
- Produces: `GET/POST /api/admin/weeks`, `GET /api/admin/weeks/[id]`, and the `/admin/haftalar/[id]` page shell that Tasks 10–13 extend with `<TeamBuilder>`, `<FixtureManager>`, `<MvpPicker>`.

- [ ] **Step 1: Write `src/app/api/admin/weeks/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const weeks = await prisma.week.findMany({ orderBy: { date: 'desc' } });
  return NextResponse.json({ weeks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, attendeePlayerIds } = body;
  if (typeof date !== 'string' || isNaN(Date.parse(date))) {
    return NextResponse.json({ error: 'Geçerli bir tarih gerekli' }, { status: 400 });
  }
  if (!Array.isArray(attendeePlayerIds) || attendeePlayerIds.length === 0) {
    return NextResponse.json({ error: 'En az bir katılımcı seçmelisin' }, { status: 400 });
  }
  const week = await prisma.week.create({
    data: {
      date: new Date(date),
      attendees: {
        create: attendeePlayerIds.map((playerId: string) => ({ playerId })),
      },
    },
  });
  return NextResponse.json({ week }, { status: 201 });
}
```

- [ ] **Step 2: Write `src/app/api/admin/weeks/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
    },
  });
  if (!week) {
    return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
  }
  return NextResponse.json({ week });
}
```

- [ ] **Step 3: Write `src/app/admin/haftalar/page.tsx`**

```tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function WeeksListPage() {
  const weeks = await prisma.week.findMany({ orderBy: { date: 'desc' } });
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Haftalar</h1>
        <Link href="/admin/haftalar/yeni" className="bg-slate-900 text-white rounded px-3 py-1">
          Yeni Hafta
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {weeks.map((week) => (
          <li key={week.id}>
            <Link href={`/admin/haftalar/${week.id}`} className="underline">
              {new Date(week.date).toLocaleDateString('tr-TR')}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/admin/haftalar/yeni/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Player {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
}

export default function NewWeekPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/players')
      .then((res) => res.json())
      .then((data) => setPlayers(data.players.filter((p: Player) => p.isActive)));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, attendeePlayerIds: Array.from(selected) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Hafta oluşturulamadı');
      return;
    }
    router.push(`/admin/haftalar/${data.week.id}`);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Yeni Hafta</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
        <div>
          <label className="block text-sm">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Katılımcılar</label>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border rounded p-2">
            {players.map((player) => (
              <label key={player.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
                {player.name} (Seviye {player.level})
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-slate-900 text-white rounded px-3 py-2">
          Haftayı Oluştur
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/app/admin/haftalar/[id]/page.tsx`**

```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: { attendees: { include: { player: true } } },
  });
  if (!week) notFound();

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, log in, then in the browser:

1. Go to `/admin/haftalar`, click "Yeni Hafta". Pick today's date, check 3-4 players, submit.
2. Confirm you land on `/admin/haftalar/<id>` showing the date and the checked players with their levels.
3. Go back to `/admin/haftalar` and confirm the new week is listed.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/weeks src/app/admin/haftalar
git commit -m "feat: add weekly session creation (attendee selection)"
```

---

## Task 10: Admin — Takım Kurucu (Öneri + Manuel Düzenleme)

**Files:**
- Create: `src/app/api/admin/weeks/[id]/teams/suggest/route.ts`
- Create: `src/app/api/admin/weeks/[id]/teams/route.ts`
- Create: `src/components/TeamBuilder.tsx`
- Modify: `src/app/admin/haftalar/[id]/page.tsx`

**Interfaces:**
- Consumes: `balanceTeams` from `@/lib/teamBalancer` (Task 4); `prisma` from `@/lib/db`.
- Produces: `POST /api/admin/weeks/[id]/teams/suggest` (returns a suggestion, does not persist), `POST /api/admin/weeks/[id]/teams` (persists final composition). Consumed by Task 11/12 (`FixtureManager` reads `week.teams`).

> **Not:** Takımlar yeniden kaydedildiğinde (bu route tekrar çağrıldığında) o haftaya ait eski takım kayıtları silinip yeniden oluşturulur; bu, cascade nedeniyle o takımlara bağlı fikstür/skorları da siler. Bu kasıtlıdır — takım kompozisyonu netleşmeden fikstür oluşturulmamalı, bu yüzden admin akışında "Takımlar" bölümü "Fikstür"den önce gelir.

- [ ] **Step 1: Write `src/app/api/admin/weeks/[id]/teams/suggest/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { balanceTeams } from '@/lib/teamBalancer';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const teamCount = Number(body.teamCount);
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return NextResponse.json({ error: 'Takım sayısı en az 2 olmalı' }, { status: 400 });
  }
  const attendees = await prisma.weekAttendee.findMany({
    where: { weekId: params.id },
    include: { player: true },
  });
  if (attendees.length < teamCount) {
    return NextResponse.json({ error: 'Katılımcı sayısı takım sayısından az' }, { status: 400 });
  }
  const players = attendees.map((a) => ({ id: a.player.id, name: a.player.name, level: a.player.level }));
  const teams = balanceTeams(players, teamCount);
  return NextResponse.json({ teams });
}
```

- [ ] **Step 2: Write `src/app/api/admin/weeks/[id]/teams/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface TeamInput {
  name: string;
  playerIds: string[];
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const teams: TeamInput[] = body.teams;
  if (!Array.isArray(teams) || teams.length < 2) {
    return NextResponse.json({ error: 'En az 2 takım gerekli' }, { status: 400 });
  }
  for (const team of teams) {
    if (typeof team.name !== 'string' || team.name.trim().length === 0) {
      return NextResponse.json({ error: 'Her takımın bir adı olmalı' }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.team.deleteMany({ where: { weekId: params.id } });
    for (const team of teams) {
      await tx.team.create({
        data: {
          weekId: params.id,
          name: team.name.trim(),
          players: { create: team.playerIds.map((playerId) => ({ playerId })) },
        },
      });
    }
  });

  const savedTeams = await prisma.team.findMany({
    where: { weekId: params.id },
    include: { players: { include: { player: true } } },
  });
  return NextResponse.json({ teams: savedTeams });
}
```

- [ ] **Step 3: Write `src/components/TeamBuilder.tsx`**

```tsx
'use client';

import { useState } from 'react';

interface AttendeePlayer {
  id: string;
  name: string;
  level: number;
}

interface TeamWithPlayers {
  id?: string;
  name: string;
  players: { player: AttendeePlayer }[];
}

interface Props {
  weekId: string;
  attendees: AttendeePlayer[];
  initialTeams: TeamWithPlayers[];
}

interface DraftTeam {
  name: string;
  playerIds: string[];
}

function toDraft(teams: TeamWithPlayers[]): DraftTeam[] {
  return teams.map((t) => ({ name: t.name, playerIds: t.players.map((p) => p.player.id) }));
}

export function TeamBuilder({ weekId, attendees, initialTeams }: Props) {
  const [teamCount, setTeamCount] = useState(2);
  const [draft, setDraft] = useState<DraftTeam[]>(toDraft(initialTeams));
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/teams/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamCount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Öneri alınamadı');
      return;
    }
    setDraft(
      data.teams.map((t: { name: string; players: AttendeePlayer[] }) => ({
        name: t.name,
        playerIds: t.players.map((p) => p.id),
      })),
    );
  }

  function playerName(id: string) {
    return attendees.find((a) => a.id === id)?.name ?? id;
  }

  function moveToTeam(playerId: string, targetIndex: number) {
    setDraft((prev) =>
      prev.map((team, index) => {
        if (index === targetIndex) {
          return team.playerIds.includes(playerId) ? team : { ...team, playerIds: [...team.playerIds, playerId] };
        }
        return { ...team, playerIds: team.playerIds.filter((id) => id !== playerId) };
      }),
    );
  }

  function renameTeam(index: number, name: string) {
    setDraft((prev) => prev.map((team, i) => (i === index ? { ...team, name } : team)));
  }

  async function save() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teams: draft }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Takımlar kaydedilemedi');
      return;
    }
    setDraft(toDraft(data.teams));
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Takımlar</h2>
      <div className="flex gap-2 items-end mb-4">
        <div>
          <label className="block text-sm">Takım sayısı</label>
          <input
            type="number"
            min={2}
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value))}
            className="border rounded px-2 py-1 w-20"
          />
        </div>
        <button onClick={suggest} className="bg-slate-900 text-white rounded px-3 py-1">
          Takımları Öner
        </button>
        <button onClick={save} className="bg-emerald-700 text-white rounded px-3 py-1">
          Kaydet
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {draft.map((team, index) => (
          <div key={index} className="border rounded p-3">
            <input
              value={team.name}
              onChange={(e) => renameTeam(index, e.target.value)}
              className="font-semibold border-b w-full mb-2"
            />
            <ul className="flex flex-col gap-1">
              {team.playerIds.map((id) => (
                <li key={id} className="flex justify-between items-center">
                  <span>{playerName(id)}</span>
                  <select
                    value={index}
                    onChange={(e) => moveToTeam(id, Number(e.target.value))}
                    className="border rounded text-sm"
                  >
                    {draft.map((_, i) => (
                      <option key={i} value={i}>
                        {draft[i].name || `Takım ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Modify `src/app/admin/haftalar/[id]/page.tsx`** — replace its full content with:

```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TeamBuilder } from '@/components/TeamBuilder';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
    },
  });
  if (!week) notFound();

  const attendeePlayers = week.attendees.map((a) => a.player);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>

      <TeamBuilder weekId={week.id} attendees={attendeePlayers} initialTeams={week.teams} />
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in, open the week detail page created in Task 9:

1. Set "Takım sayısı" to 2, click "Takımları Öner" — confirm two team cards appear with names "Takım A"/"Takım B" and players split roughly evenly by level (check the levels you assigned in `/admin/oyuncular`).
2. Rename a team, move one player to the other team via its dropdown, click "Kaydet".
3. Reload the page — confirm the saved composition (names + player assignment) persists.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/weeks/[id]/teams src/components/TeamBuilder.tsx src/app/admin/haftalar/[id]/page.tsx
git commit -m "feat: add level-balanced team suggestion and manual team builder"
```

---

## Task 11: Admin — Fikstür Oluşturma

**Files:**
- Create: `src/app/api/admin/weeks/[id]/matches/route.ts`
- Create: `src/components/FixtureManager.tsx`
- Modify: `src/app/admin/haftalar/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `POST /api/admin/weeks/[id]/matches`. `FixtureManager` is extended by Task 12 to add score entry.

- [ ] **Step 1: Write `src/app/api/admin/weeks/[id]/matches/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const { teamAId, teamBId } = body;
  if (typeof teamAId !== 'string' || typeof teamBId !== 'string' || teamAId === teamBId) {
    return NextResponse.json({ error: 'İki farklı takım seçmelisin' }, { status: 400 });
  }
  const match = await prisma.match.create({
    data: { weekId: params.id, teamAId, teamBId, sets: [] },
  });
  return NextResponse.json({ match }, { status: 201 });
}
```

- [ ] **Step 2: Write `src/components/FixtureManager.tsx`**

```tsx
'use client';

import { useState } from 'react';

interface TeamOption {
  id: string;
  name: string;
}

interface MatchItem {
  id: string;
  teamAId: string;
  teamBId: string;
  sets: [number, number][];
}

interface Props {
  weekId: string;
  teams: TeamOption[];
  initialMatches: MatchItem[];
}

export function FixtureManager({ weekId, teams, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id;
  }

  async function addMatch() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAId, teamBId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Maç eklenemedi');
      return;
    }
    setMatches((prev) => [...prev, data.match]);
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Fikstür</h2>
      <div className="flex gap-2 items-end mb-4">
        <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span>vs</span>
        <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button onClick={addMatch} className="bg-slate-900 text-white rounded px-3 py-1">
          Maç Ekle
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="flex flex-col gap-2">
        {matches.map((match) => (
          <li key={match.id} className="border rounded p-2 flex justify-between items-center">
            <span>{teamName(match.teamAId)} - {teamName(match.teamBId)}</span>
            <span className="text-slate-500 text-sm">Henüz oynanmadı</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Modify `src/app/admin/haftalar/[id]/page.tsx`** — replace its full content with:

```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TeamBuilder } from '@/components/TeamBuilder';
import { FixtureManager } from '@/components/FixtureManager';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
    },
  });
  if (!week) notFound();

  const attendeePlayers = week.attendees.map((a) => a.player);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>

      <TeamBuilder weekId={week.id} attendees={attendeePlayers} initialTeams={week.teams} />

      <FixtureManager
        weekId={week.id}
        teams={week.teams.map((t) => ({ id: t.id, name: t.name }))}
        initialMatches={week.matches.map((m) => ({
          id: m.id,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          sets: m.sets as [number, number][],
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

With teams already saved from Task 10's verification, on the same week detail page:

1. Pick the two teams in the dropdowns, click "Maç Ekle" — confirm a new fixture row appears showing "Takım A - Takım B: Henüz oynanmadı".
2. Reload the page — confirm the fixture is still listed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/weeks/[id]/matches src/components/FixtureManager.tsx src/app/admin/haftalar/[id]/page.tsx
git commit -m "feat: add fixture creation (team pairing per week)"
```

---

## Task 12: Admin — Maç Skoru Girme

**Files:**
- Create: `src/app/api/admin/matches/[id]/route.ts`
- Modify: `src/components/FixtureManager.tsx`

**Interfaces:**
- Consumes: `computeMatchResult` from `@/lib/matchScoring` (Task 3).
- Produces: `PATCH /api/admin/matches/[id]`. `FixtureManager` now shows live scores; consumed as-is by Task 14's public pages (same data shape).

- [ ] **Step 1: Write `src/app/api/admin/matches/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMatchResult } from '@/lib/matchScoring';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const sets = body.sets;
  if (!Array.isArray(sets)) {
    return NextResponse.json({ error: 'Set skorları gerekli' }, { status: 400 });
  }
  try {
    computeMatchResult(sets);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  const match = await prisma.match.update({ where: { id: params.id }, data: { sets } });
  return NextResponse.json({ match });
}
```

- [ ] **Step 2: Modify `src/components/FixtureManager.tsx`** — replace its full content with:

```tsx
'use client';

import { useState } from 'react';
import { computeMatchResult } from '@/lib/matchScoring';

interface TeamOption {
  id: string;
  name: string;
}

interface MatchItem {
  id: string;
  teamAId: string;
  teamBId: string;
  sets: [number, number][];
}

interface Props {
  weekId: string;
  teams: TeamOption[];
  initialMatches: MatchItem[];
}

function ScoreForm({ match, onSaved }: { match: MatchItem; onSaved: (m: MatchItem) => void }) {
  const [sets, setSets] = useState<[number, number][]>(
    match.sets.length > 0 ? match.sets : [[0, 0], [0, 0]],
  );
  const [error, setError] = useState<string | null>(null);

  function updateSet(index: number, side: 0 | 1, value: number) {
    setSets((prev) =>
      prev.map((s, i) =>
        i === index ? ([side === 0 ? value : s[0], side === 1 ? value : s[1]] as [number, number]) : s,
      ),
    );
  }

  function addSet() {
    if (sets.length < 3) setSets((prev) => [...prev, [0, 0]]);
  }

  async function save() {
    setError(null);
    try {
      computeMatchResult(sets);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const res = await fetch(`/api/admin/matches/${match.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sets }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Skor kaydedilemedi');
      return;
    }
    onSaved(data.match);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {sets.map((set, index) => (
          <div key={index} className="flex gap-1 items-center">
            <input
              type="number"
              min={0}
              value={set[0]}
              onChange={(e) => updateSet(index, 0, Number(e.target.value))}
              className="border rounded w-14 px-1"
            />
            <span>-</span>
            <input
              type="number"
              min={0}
              value={set[1]}
              onChange={(e) => updateSet(index, 1, Number(e.target.value))}
              className="border rounded w-14 px-1"
            />
          </div>
        ))}
        {sets.length < 3 && (
          <button onClick={addSet} className="text-sm underline">
            + Set
          </button>
        )}
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={save} className="bg-emerald-700 text-white rounded px-3 py-1 w-fit">
        Skoru Kaydet
      </button>
    </div>
  );
}

export function FixtureManager({ weekId, teams, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches);
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? '');
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  function teamName(id: string) {
    return teams.find((t) => t.id === id)?.name ?? id;
  }

  async function addMatch() {
    setError(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamAId, teamBId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Maç eklenemedi');
      return;
    }
    setMatches((prev) => [...prev, data.match]);
  }

  function handleSaved(updated: MatchItem) {
    setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Fikstür & Sonuçlar</h2>
      <div className="flex gap-2 items-end mb-4">
        <select value={teamAId} onChange={(e) => setTeamAId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <span>vs</span>
        <select value={teamBId} onChange={(e) => setTeamBId(e.target.value)} className="border rounded px-2 py-1">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button onClick={addMatch} className="bg-slate-900 text-white rounded px-3 py-1">
          Maç Ekle
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="flex flex-col gap-4">
        {matches.map((match) => (
          <li key={match.id} className="border rounded p-3">
            <div className="font-medium mb-2">
              {teamName(match.teamAId)} - {teamName(match.teamBId)}
            </div>
            <ScoreForm match={match} onSaved={handleSaved} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Manual verification**

On the week detail page, for the fixture created in Task 11:

1. Enter set scores `25-20`, `25-18`, click "Skoru Kaydet" — expect no error.
2. Reload the page — confirm the entered scores are still shown in the inputs.
3. Try an invalid score: two sets `25-25` (a tie) — expect the red error message "Bir set berabere bitemez" and no save.
4. `curl -i -b cookies.txt -X PATCH http://localhost:3000/api/admin/matches/<matchId> -H "Content-Type: application/json" -d "{\"sets\":[[25,20]]}"` → expected `400` (fewer than 2 sets).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/matches src/components/FixtureManager.tsx
git commit -m "feat: add match score entry with validation"
```

---

## Task 13: Admin — Haftanın Oyuncusu Seçimi

**Files:**
- Create: `src/app/api/admin/weeks/[id]/mvps/route.ts`
- Create: `src/components/MvpPicker.tsx`
- Modify: `src/app/admin/haftalar/[id]/page.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `PUT /api/admin/weeks/[id]/mvps`. Completes the week-management page; consumed by Task 14's public `WeekView`.

- [ ] **Step 1: Write `src/app/api/admin/weeks/[id]/mvps/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const playerIds = body.playerIds;
  if (!Array.isArray(playerIds)) {
    return NextResponse.json({ error: 'Oyuncu listesi gerekli' }, { status: 400 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.weeklyMvp.deleteMany({ where: { weekId: params.id } });
    for (const playerId of playerIds) {
      await tx.weeklyMvp.create({ data: { weekId: params.id, playerId } });
    }
  });
  const mvps = await prisma.weeklyMvp.findMany({ where: { weekId: params.id }, include: { player: true } });
  return NextResponse.json({ mvps });
}
```

- [ ] **Step 2: Write `src/components/MvpPicker.tsx`**

```tsx
'use client';

import { useState } from 'react';

interface AttendeePlayer {
  id: string;
  name: string;
}

interface Props {
  weekId: string;
  attendees: AttendeePlayer[];
  initialMvpPlayerIds: string[];
}

export function MvpPicker({ weekId, attendees, initialMvpPlayerIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialMvpPlayerIds));
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    await fetch(`/api/admin/weeks/${weekId}/mvps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: Array.from(selected) }),
    });
    setSaved(true);
  }

  return (
    <section className="mt-8">
      <h2 className="font-semibold mb-2">Haftanın Oyuncusu</h2>
      <div className="flex flex-col gap-1 max-w-sm">
        {attendees.map((player) => (
          <label key={player.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.has(player.id)} onChange={() => toggle(player.id)} />
            {player.name}
          </label>
        ))}
      </div>
      <button onClick={save} className="bg-emerald-700 text-white rounded px-3 py-1 mt-2">
        Kaydet
      </button>
      {saved && <span className="text-emerald-700 text-sm ml-2">Kaydedildi</span>}
    </section>
  );
}
```

- [ ] **Step 3: Modify `src/app/admin/haftalar/[id]/page.tsx`** — replace its full content with:

```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TeamBuilder } from '@/components/TeamBuilder';
import { FixtureManager } from '@/components/FixtureManager';
import { MvpPicker } from '@/components/MvpPicker';

export default async function WeekDetailPage({ params }: { params: { id: string } }) {
  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendees: { include: { player: true } },
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
    },
  });
  if (!week) notFound();

  const attendeePlayers = week.attendees.map((a) => a.player);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <h2 className="font-semibold mb-2">Katılımcılar ({week.attendees.length})</h2>
      <ul className="list-disc list-inside">
        {week.attendees.map((a) => (
          <li key={a.id}>
            {a.player.name} (Seviye {a.player.level})
          </li>
        ))}
      </ul>

      <TeamBuilder weekId={week.id} attendees={attendeePlayers} initialTeams={week.teams} />

      <FixtureManager
        weekId={week.id}
        teams={week.teams.map((t) => ({ id: t.id, name: t.name }))}
        initialMatches={week.matches.map((m) => ({
          id: m.id,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          sets: m.sets as [number, number][],
        }))}
      />

      <MvpPicker
        weekId={week.id}
        attendees={attendeePlayers}
        initialMvpPlayerIds={week.mvps.map((m) => m.playerId)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

On the week detail page:

1. Check one or two players under "Haftanın Oyuncusu", click "Kaydet" — confirm "Kaydedildi" appears.
2. Reload the page — confirm the same players remain checked.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/weeks/[id]/mvps src/components/MvpPicker.tsx src/app/admin/haftalar/[id]/page.tsx
git commit -m "feat: add weekly MVP selection"
```

---

## Task 14: Herkese Açık — Ana Sayfa (Güncel Hafta)

**Files:**
- Create: `src/lib/weekView.ts`
- Create: `src/components/WeekView.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `computeMatchResult` from `@/lib/matchScoring`; `computeStandings` from `@/lib/standings`.
- Produces: `interface WeekViewData` and `async function getWeekView(weekId: string): Promise<WeekViewData | null>`, plus the `<WeekView>` presentational component — both reused by Task 15's archive/week-detail public pages.

- [ ] **Step 1: Write `src/lib/weekView.ts`**

```ts
import { prisma } from '@/lib/db';
import { computeMatchResult, type MatchResult, type SetScore } from '@/lib/matchScoring';
import { computeStandings, type StandingsRow } from '@/lib/standings';

export interface WeekViewData {
  id: string;
  date: Date;
  teams: { id: string; name: string; players: { id: string; name: string; level: number }[] }[];
  matches: {
    id: string;
    teamAId: string;
    teamBId: string;
    sets: SetScore[];
    result: MatchResult | null;
  }[];
  standings: StandingsRow[];
  mvps: { id: string; name: string }[];
}

export async function getWeekView(weekId: string): Promise<WeekViewData | null> {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      teams: { include: { players: { include: { player: true } } } },
      matches: true,
      mvps: { include: { player: true } },
    },
  });
  if (!week) return null;

  const matches = week.matches.map((m) => {
    const sets = m.sets as SetScore[];
    const result = sets.length >= 2 ? computeMatchResult(sets) : null;
    return { id: m.id, teamAId: m.teamAId, teamBId: m.teamBId, sets, result };
  });

  const playedMatches = matches.filter((m) => m.sets.length >= 2);
  const standings = computeStandings({
    teams: week.teams.map((t) => ({ id: t.id, name: t.name })),
    matches: playedMatches.map((m) => ({ teamAId: m.teamAId, teamBId: m.teamBId, sets: m.sets })),
  });

  return {
    id: week.id,
    date: week.date,
    teams: week.teams.map((t) => ({
      id: t.id,
      name: t.name,
      players: t.players.map((p) => ({ id: p.player.id, name: p.player.name, level: p.player.level })),
    })),
    matches,
    standings,
    mvps: week.mvps.map((m) => ({ id: m.player.id, name: m.player.name })),
  };
}
```

- [ ] **Step 2: Write `src/components/WeekView.tsx`**

```tsx
import type { WeekViewData } from '@/lib/weekView';

export function WeekView({ week }: { week: WeekViewData }) {
  function teamName(id: string) {
    return week.teams.find((t) => t.id === id)?.name ?? id;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Puan Durumu</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2">Takım</th>
              <th className="py-2">O</th>
              <th className="py-2">G</th>
              <th className="py-2">M</th>
              <th className="py-2">Set Av.</th>
              <th className="py-2">Puan</th>
            </tr>
          </thead>
          <tbody>
            {week.standings.map((row) => (
              <tr key={row.teamId} className="border-b">
                <td className="py-2">{row.teamName}</td>
                <td className="py-2">{row.played}</td>
                <td className="py-2">{row.won}</td>
                <td className="py-2">{row.lost}</td>
                <td className="py-2">{row.setDiff}</td>
                <td className="py-2 font-semibold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Maç Sonuçları</h2>
        <ul className="flex flex-col gap-2">
          {week.matches.map((match) => (
            <li key={match.id} className="border rounded p-2">
              <span>
                {teamName(match.teamAId)} - {teamName(match.teamBId)}:{' '}
              </span>
              {match.result ? (
                <span className="font-semibold">
                  {match.result.setsWonA}-{match.result.setsWonB} (
                  {match.sets.map(([a, b]) => `${a}-${b}`).join(', ')})
                </span>
              ) : (
                <span className="text-slate-500">Henüz oynanmadı</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Haftanın Oyuncusu</h2>
        {week.mvps.length === 0 ? (
          <p className="text-slate-500">Henüz seçilmedi</p>
        ) : (
          <ul className="flex gap-2 flex-wrap">
            {week.mvps.map((mvp) => (
              <li key={mvp.id} className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-sm font-medium">
                ⭐ {mvp.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Modify `src/app/page.tsx`** — replace its full content with:

```tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';

export default async function HomePage() {
  const latestWeek = await prisma.week.findFirst({ orderBy: { date: 'desc' } });

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Haftalık Voleybol</h1>
        <Link href="/arsiv" className="underline text-sm">
          Geçmiş Haftalar
        </Link>
      </div>
      {!latestWeek ? (
        <p className="text-slate-600">Henüz hafta eklenmedi.</p>
      ) : (
        <WeekViewLoader weekId={latestWeek.id} />
      )}
    </main>
  );
}

async function WeekViewLoader({ weekId }: { weekId: string }) {
  const week = await getWeekView(weekId);
  if (!week) return null;
  return <WeekView week={week} />;
}
```

- [ ] **Step 4: Manual verification**

Using the week/teams/match/MVP data created in Tasks 9–13:

1. Open `http://localhost:3000/` in a private/incognito window (no admin cookie) — confirm the page loads without redirecting to login and shows the standings table, the match result with its set score, and the "Haftanın Oyuncusu" badge for the players picked in Task 13.
2. Confirm the standings row for the team that won 2-0 shows 3 points, and set difference matches (won sets - lost sets).
3. `curl -s http://localhost:3000/` (no cookie) → expect `200` with the standings table HTML present.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekView.ts src/components/WeekView.tsx src/app/page.tsx
git commit -m "feat: add public home page showing latest week's results and standings"
```

---

## Task 15: Herkese Açık — Arşiv ve Hafta Detay Sayfaları

**Files:**
- Create: `src/app/hafta/[weekId]/page.tsx`
- Create: `src/app/arsiv/page.tsx`

**Interfaces:**
- Consumes: `getWeekView` from `@/lib/weekView`, `<WeekView>` from `@/components/WeekView` (Task 14); `prisma` from `@/lib/db`.

- [ ] **Step 1: Write `src/app/hafta/[weekId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getWeekView } from '@/lib/weekView';
import { WeekView } from '@/components/WeekView';

export default async function WeekPage({ params }: { params: { weekId: string } }) {
  const week = await getWeekView(params.weekId);
  if (!week) notFound();
  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/arsiv" className="underline text-sm">
        ← Tüm Haftalar
      </Link>
      <div className="mt-4">
        <WeekView week={week} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `src/app/arsiv/page.tsx`**

```tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function ArchivePage() {
  const weeks = await prisma.week.findMany({ orderBy: { date: 'desc' } });
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Geçmiş Haftalar</h1>
      <ul className="flex flex-col gap-2">
        {weeks.map((week) => (
          <li key={week.id}>
            <Link href={`/hafta/${week.id}`} className="underline">
              {new Date(week.date).toLocaleDateString('tr-TR')}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

1. Open `http://localhost:3000/arsiv` — confirm it lists every week created so far, most recent first.
2. Click a week — confirm `/hafta/<id>` renders the same standings/results/MVP layout as the home page, with a "← Tüm Haftalar" link back to `/arsiv`.
3. Visit a bogus id, e.g. `http://localhost:3000/hafta/does-not-exist` — confirm a 404 page.

- [ ] **Step 4: Commit**

```bash
git add src/app/hafta src/app/arsiv
git commit -m "feat: add public archive list and per-week detail page"
```

---

## Task 16: Deployment (Vercel + Neon)

**Files:**
- Modify: none expected (config is done through hosting dashboards / CLI)

**Interfaces:**
- Consumes: the full app from Tasks 1–15.
- Produces: a public URL serving the app.

> **⚠️ Kullanıcı girdisi gerekli — bu adımların tamamı harici hesap işlemleri içerir:**

- [ ] **Step 1: Prisma prod migration**

Point `DATABASE_URL` (temporarily, in your shell) at the production Postgres connection string (same Neon project as dev, or a separate prod branch/project if you created one), then run:

Run: `npx prisma migrate deploy`
Expected: applies all migrations from `prisma/migrations/` to the production database, prints success.

- [ ] **Step 2: Create the Vercel project and set env vars**

1. `npx vercel login` (opens a browser to authenticate).
2. `npx vercel link` (creates/links a Vercel project for this directory).
3. For each of `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`: `npx vercel env add <NAME> production` and paste the value when prompted.

- [ ] **Step 3: Deploy**

Run: `npx vercel --prod`
Expected: prints a production URL (e.g. `https://voleybol.vercel.app`).

- [ ] **Step 4: Smoke test the live deployment**

1. `curl -s https://<your-deployment-url>/` → expect `200`.
2. Open `https://<your-deployment-url>/login` in a browser, log in with the admin credentials configured in Step 2, confirm `/admin` loads.
3. Open `https://<your-deployment-url>/` in an incognito window, confirm the same public results page you saw locally in Task 14 renders correctly.

- [ ] **Step 5: Share the link**

Share the production home page URL with the players — this satisfies the original goal of a Mackolik-style public results page.
