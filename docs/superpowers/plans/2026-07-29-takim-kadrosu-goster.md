# Ana Sayfada Takım Kadrosu Gösterimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make team names in the public `WeekView` component (used on both `/` and `/hafta/[weekId]`) expandable via native `<details>/<summary>`, so clicking a team name reveals its player roster (name + level) — no new data fetching, since `WeekViewData.teams[].players` is already populated.

**Architecture:** A single new unexported helper component, `TeamRoster`, added inside `src/components/WeekView.tsx`. It looks up a team by id in the already-passed `week` prop and renders a `<details>` element. Both places that currently print a bare team name (the standings table and the match results list) switch to this component. The existing `teamName(id)` helper is removed since both its call sites move to `TeamRoster`.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS utility classes only — same stack as the rest of the project. No client component needed (`<details>` is native HTML).

## Global Constraints

- All UI copy is in Turkish.
- Styling via Tailwind CSS utility classes only — no separate CSS files.
- Next.js 14+ App Router, TypeScript strict mode.
- Pure presentation change (no new business logic, no new data fetching) — per the project's test strategy only `src/lib/*` gets Vitest coverage. Verification here is manual (`npm run build` + `npm run dev` + browser/curl check).

---

## Task 1: `TeamRoster` ile Takım İsimlerini Tıklanabilir Yap

**Files:**
- Modify: `src/components/WeekView.tsx` (full replacement below)

**Interfaces:**
- Consumes: `WeekViewData` type from `@/lib/weekView` (already imported) — specifically `week.teams[].players[].{id,name,level}`, already populated by `getWeekView` (Task 14, existing code, no changes needed there).
- Produces: no new exports — `TeamRoster` is a private helper used only within this file.

- [ ] **Step 1: Replace the full content of `src/components/WeekView.tsx`**

```tsx
import type { WeekViewData } from '@/lib/weekView';

function TeamRoster({ teamId, week }: { teamId: string; week: WeekViewData }) {
  const team = week.teams.find((t) => t.id === teamId);
  if (!team) return <>{teamId}</>;
  return (
    <details className="inline-block">
      <summary className="cursor-pointer underline decoration-dotted">{team.name}</summary>
      <ul className="mt-1 list-disc list-inside text-xs text-slate-500 font-normal">
        {team.players.map((p) => (
          <li key={p.id}>
            {p.name} (Seviye {p.level})
          </li>
        ))}
      </ul>
    </details>
  );
}

export function WeekView({ week }: { week: WeekViewData }) {
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
                <td className="py-2">
                  <TeamRoster teamId={row.teamId} week={week} />
                </td>
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
                <TeamRoster teamId={match.teamAId} week={week} /> -{' '}
                <TeamRoster teamId={match.teamBId} week={week} />:{' '}
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0, no new warnings/errors beyond the pre-existing bcryptjs Edge Runtime warning.

- [ ] **Step 4: Manual verification with seeded data**

The public pages only render team rosters when a `Week` with `Team`/`TeamPlayer` rows exists. Seed temporary data, verify, then clean up — following the same pattern used for Task 14/15's manual verification:

1. Write a temporary script `prisma/verify-roster-tmp.ts`:

```ts
import { prisma } from '../src/lib/db';

async function main() {
  const p1 = await prisma.player.create({ data: { name: 'Test Oyuncu 1', level: 8 } });
  const p2 = await prisma.player.create({ data: { name: 'Test Oyuncu 2', level: 7 } });

  const week = await prisma.week.create({
    data: {
      date: new Date(),
      attendees: { create: [p1, p2].map((p) => ({ playerId: p.id })) },
    },
  });

  const teamA = await prisma.team.create({
    data: { weekId: week.id, name: 'Takım A', players: { create: [{ playerId: p1.id }] } },
  });
  const teamB = await prisma.team.create({
    data: { weekId: week.id, name: 'Takım B', players: { create: [{ playerId: p2.id }] } },
  });

  await prisma.match.create({
    data: {
      weekId: week.id,
      teamAId: teamA.id,
      teamBId: teamB.id,
      sets: [
        [25, 20],
        [25, 18],
      ],
    },
  });

  console.log('WEEK_ID=' + week.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

2. Run: `npx tsx prisma/verify-roster-tmp.ts` — note the printed `WEEK_ID`.
3. Run `npm run dev` (background), then:
   - `curl -s http://localhost:3000/` and grep for `<details`, `<summary`, `Test Oyuncu 1`, `Test Oyuncu 2`, `Seviye 8`, `Seviye 7` — all must be present (the HTML for `<details>` includes its content in the initial server-rendered markup even when closed, since there's no client JS toggling visibility).
   - Open `http://localhost:3000/` in a browser, confirm clicking "Takım A" in the Puan Durumu table expands a list showing "Test Oyuncu 1 (Seviye 8)", and clicking again collapses it. Confirm the same for "Takım A"/"Takım B" in the Maç Sonuçları line.
   - Repeat on `http://localhost:3000/hafta/<WEEK_ID>`.
4. Stop the dev server.
5. Write `prisma/verify-roster-tmp.ts` with cleanup content:

```ts
import { prisma } from '../src/lib/db';

async function main() {
  await prisma.week.deleteMany({});
  await prisma.player.deleteMany({ where: { name: { startsWith: 'Test Oyuncu' } } });
  console.log('cleaned up');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Run: `npx tsx prisma/verify-roster-tmp.ts`, confirm it prints `cleaned up`, then delete the temporary script file (`prisma/verify-roster-tmp.ts`) — it must not be committed.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeekView.tsx
git commit -m "feat: make team names expandable to show player rosters"
```
