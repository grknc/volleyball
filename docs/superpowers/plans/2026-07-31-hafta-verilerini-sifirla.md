# Hafta Verilerini Sıfırla Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only "Hafta Verilerini Sıfırla" action that wipes a week's Team/TeamPlayer/Match/WeeklyMvp (and optionally WeekAttendee) records inside a single Prisma transaction, optionally resets `Week.status` to `'draft'`, and never touches the `Week` row itself, `Player` rows, or any other week's data.

**Architecture:** A pure decision function (`planWeekReset`) determines what to delete/update from the request flags. A service function (`resetWeekData`) takes a Prisma transaction client and executes the deletes/update in dependency order, returning real DB-measured counts. A thin `POST /api/admin/weeks/:id/reset` route validates the request body and wraps `resetWeekData` in `prisma.$transaction`. A new `WeekResetControl` client component (reusing the existing `ConfirmDialog`, extended with a `children` slot) drives the confirmation UI from the admin week detail page.

**Tech Stack:** Next.js 14 App Router, Prisma 5 / PostgreSQL, TypeScript, Vitest 2, Tailwind (no component library).

## Global Constraints

- `Week` rows and `Player` rows are never deleted or mutated except `Week.status` (only when `resetStatus: true`, only to `'draft'`).
- Every delete query is scoped to the target week's `weekId` (or that week's `teamIds`) — no query may be able to match another week's rows.
- `removeAttendees` and `resetStatus` request body fields must be strict `boolean` when present; any other type → `400`, not silently coerced to `false`.
- Raw Prisma/DB errors are never returned to the client; unexpected errors log via `console.error` and return a generic `500`.
- `Week.status` update happens as the last write inside the transaction, after all deletes.
- The reset endpoint needs no manual auth check — `src/middleware.ts` already gates `/api/admin/:path*`.
- `npm test` (`vitest run`) must never touch a real database. The integration test added in this plan only runs via `npm run test:db`, and only when `RUN_DB_TESTS=1`, `TEST_DATABASE_URL` is set, and `TEST_DATABASE_URL !== DATABASE_URL`.
- Spec of record: `docs/superpowers/specs/2026-07-31-hafta-verilerini-sifirla-design.md`.

---

### Task 1: `planWeekReset` — pure decision function

**Files:**
- Create: `src/lib/weekResetPlan.ts`
- Test: `src/lib/weekResetPlan.test.ts`

**Interfaces:**
- Consumes: `WeekStatus` type from `src/lib/constants.ts`
- Produces:
  ```ts
  export interface WeekResetOptions {
    removeAttendees: boolean;
    resetStatus: boolean;
  }
  export interface WeekResetPlan {
    removeAttendees: boolean;
    updateStatus: boolean;
    resultStatus: WeekStatus;
  }
  export function planWeekReset(options: WeekResetOptions, currentStatus: WeekStatus): WeekResetPlan
  ```
  Task 2 imports `planWeekReset`, `WeekResetOptions`, `WeekResetPlan` from this file.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/weekResetPlan.test.ts
import { describe, expect, it } from 'vitest';
import { planWeekReset } from './weekResetPlan';

describe('planWeekReset', () => {
  it('keeps removeAttendees flag as-is', () => {
    expect(planWeekReset({ removeAttendees: true, resetStatus: false }, 'completed').removeAttendees).toBe(true);
    expect(planWeekReset({ removeAttendees: false, resetStatus: false }, 'completed').removeAttendees).toBe(false);
  });

  it('sets resultStatus to draft and updateStatus true when resetStatus is true', () => {
    const plan = planWeekReset({ removeAttendees: false, resetStatus: true }, 'archived');
    expect(plan.updateStatus).toBe(true);
    expect(plan.resultStatus).toBe('draft');
  });

  it('keeps the current status and updateStatus false when resetStatus is false', () => {
    const plan = planWeekReset({ removeAttendees: false, resetStatus: false }, 'archived');
    expect(plan.updateStatus).toBe(false);
    expect(plan.resultStatus).toBe('archived');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/weekResetPlan.test.ts`
Expected: FAIL with `Cannot find module './weekResetPlan'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/weekResetPlan.ts
import type { WeekStatus } from './constants';

export interface WeekResetOptions {
  removeAttendees: boolean;
  resetStatus: boolean;
}

export interface WeekResetPlan {
  removeAttendees: boolean;
  updateStatus: boolean;
  resultStatus: WeekStatus;
}

export function planWeekReset(options: WeekResetOptions, currentStatus: WeekStatus): WeekResetPlan {
  return {
    removeAttendees: options.removeAttendees,
    updateStatus: options.resetStatus,
    resultStatus: options.resetStatus ? 'draft' : currentStatus,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/weekResetPlan.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekResetPlan.ts src/lib/weekResetPlan.test.ts
git commit -m "feat: add planWeekReset pure decision function"
```

---

### Task 2: `resetWeekData` — service function + orchestration unit tests

**Files:**
- Create: `src/lib/weekResetService.ts`
- Test: `src/lib/weekResetService.orchestration.test.ts`

**Interfaces:**
- Consumes: `planWeekReset`, `WeekResetOptions` from `src/lib/weekResetPlan.ts` (Task 1); `SetScore` type from `src/lib/matchScoring.ts`; `Prisma` type from `@prisma/client`.
- Produces:
  ```ts
  export class WeekNotFoundError extends Error {}
  export interface WeekResetResult {
    status: string;
    deleted: { teams: number; matches: number; sets: number; mvps: number; attendees: number };
  }
  export async function resetWeekData(
    tx: Prisma.TransactionClient,
    weekId: string,
    options: WeekResetOptions
  ): Promise<WeekResetResult>
  ```
  Task 3 (route) and Task 8 (integration test) import `resetWeekData` and `WeekNotFoundError` from this file.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/weekResetService.orchestration.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { resetWeekData, WeekNotFoundError } from './weekResetService';

function createMockTx() {
  const tx = {
    week: { findUnique: vi.fn(), update: vi.fn() },
    team: { findMany: vi.fn(), deleteMany: vi.fn() },
    match: { findMany: vi.fn(), deleteMany: vi.fn() },
    teamPlayer: { deleteMany: vi.fn() },
    weeklyMvp: { deleteMany: vi.fn() },
    weekAttendee: { deleteMany: vi.fn() },
  };
  tx.week.findUnique.mockResolvedValue({ id: 'week-1', status: 'archived' });
  tx.week.update.mockResolvedValue({ id: 'week-1', status: 'draft' });
  tx.team.findMany.mockResolvedValue([{ id: 'team-1' }, { id: 'team-2' }]);
  tx.team.deleteMany.mockResolvedValue({ count: 2 });
  tx.match.findMany.mockResolvedValue([
    { sets: [[25, 20], [25, 18]] },
    { sets: [[25, 10]] },
  ]);
  tx.match.deleteMany.mockResolvedValue({ count: 2 });
  tx.teamPlayer.deleteMany.mockResolvedValue({ count: 8 });
  tx.weeklyMvp.deleteMany.mockResolvedValue({ count: 1 });
  tx.weekAttendee.deleteMany.mockResolvedValue({ count: 8 });
  return tx;
}

describe('resetWeekData', () => {
  it('throws WeekNotFoundError when the week does not exist', async () => {
    const tx = createMockTx();
    tx.week.findUnique.mockResolvedValue(null);
    await expect(
      resetWeekData(tx as unknown as Prisma.TransactionClient, 'missing', {
        removeAttendees: false,
        resetStatus: false,
      })
    ).rejects.toBeInstanceOf(WeekNotFoundError);
  });

  it('deletes children scoped to the week/team ids and returns real counts', async () => {
    const tx = createMockTx();
    const result = await resetWeekData(tx as unknown as Prisma.TransactionClient, 'week-1', {
      removeAttendees: false,
      resetStatus: false,
    });

    expect(tx.weeklyMvp.deleteMany).toHaveBeenCalledWith({ where: { weekId: 'week-1' } });
    expect(tx.teamPlayer.deleteMany).toHaveBeenCalledWith({ where: { teamId: { in: ['team-1', 'team-2'] } } });
    expect(tx.match.deleteMany).toHaveBeenCalledWith({ where: { weekId: 'week-1' } });
    expect(tx.team.deleteMany).toHaveBeenCalledWith({ where: { weekId: 'week-1' } });
    expect(tx.weekAttendee.deleteMany).not.toHaveBeenCalled();
    expect(tx.week.update).not.toHaveBeenCalled();

    expect(result).toEqual({
      status: 'archived',
      deleted: { teams: 2, matches: 2, sets: 3, mvps: 1, attendees: 0 },
    });
  });

  it('deletes attendees only when removeAttendees is true', async () => {
    const tx = createMockTx();
    await resetWeekData(tx as unknown as Prisma.TransactionClient, 'week-1', {
      removeAttendees: true,
      resetStatus: false,
    });
    expect(tx.weekAttendee.deleteMany).toHaveBeenCalledWith({ where: { weekId: 'week-1' } });
  });

  it('updates status to draft only when resetStatus is true', async () => {
    const tx = createMockTx();
    const result = await resetWeekData(tx as unknown as Prisma.TransactionClient, 'week-1', {
      removeAttendees: false,
      resetStatus: true,
    });
    expect(tx.week.update).toHaveBeenCalledWith({ where: { id: 'week-1' }, data: { status: 'draft' } });
    expect(result.status).toBe('draft');
  });

  it('skips teamPlayer.deleteMany when the week has no teams', async () => {
    const tx = createMockTx();
    tx.team.findMany.mockResolvedValue([]);
    tx.team.deleteMany.mockResolvedValue({ count: 0 });
    await resetWeekData(tx as unknown as Prisma.TransactionClient, 'week-1', {
      removeAttendees: false,
      resetStatus: false,
    });
    expect(tx.teamPlayer.deleteMany).not.toHaveBeenCalled();
  });

  it('calls deleteMany/update steps in dependency order, status last', async () => {
    const tx = createMockTx();
    await resetWeekData(tx as unknown as Prisma.TransactionClient, 'week-1', {
      removeAttendees: true,
      resetStatus: true,
    });

    const order = [
      tx.weeklyMvp.deleteMany.mock.invocationCallOrder[0],
      tx.teamPlayer.deleteMany.mock.invocationCallOrder[0],
      tx.match.deleteMany.mock.invocationCallOrder[0],
      tx.team.deleteMany.mock.invocationCallOrder[0],
      tx.weekAttendee.deleteMany.mock.invocationCallOrder[0],
      tx.week.update.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/weekResetService.orchestration.test.ts`
Expected: FAIL with `Cannot find module './weekResetService'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/weekResetService.ts
import type { Prisma } from '@prisma/client';
import type { SetScore } from './matchScoring';
import { planWeekReset, type WeekResetOptions } from './weekResetPlan';
import type { WeekStatus } from './constants';

export class WeekNotFoundError extends Error {}

export interface WeekResetResult {
  status: string;
  deleted: {
    teams: number;
    matches: number;
    sets: number;
    mvps: number;
    attendees: number;
  };
}

/**
 * Testable service function (not pure — writes to the DB via the injected
 * transaction client). Deletes a week's Team/TeamPlayer/Match/WeeklyMvp
 * (and optionally WeekAttendee) rows and optionally resets Week.status to
 * 'draft'. Must run inside prisma.$transaction; never touches the Week row
 * itself except its `status`, and never touches Player rows or other weeks.
 */
export async function resetWeekData(
  tx: Prisma.TransactionClient,
  weekId: string,
  options: WeekResetOptions
): Promise<WeekResetResult> {
  const week = await tx.week.findUnique({ where: { id: weekId } });
  if (!week) throw new WeekNotFoundError();

  const plan = planWeekReset(options, week.status as WeekStatus);

  const teams = await tx.team.findMany({ where: { weekId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);

  const matches = await tx.match.findMany({ where: { weekId }, select: { sets: true } });
  const setCount = matches.reduce((sum, m) => sum + (m.sets as SetScore[]).length, 0);

  const mvpResult = await tx.weeklyMvp.deleteMany({ where: { weekId } });

  if (teamIds.length > 0) {
    await tx.teamPlayer.deleteMany({ where: { teamId: { in: teamIds } } });
  }

  const matchResult = await tx.match.deleteMany({ where: { weekId } });
  const teamResult = await tx.team.deleteMany({ where: { weekId } });

  const attendeeResult = plan.removeAttendees
    ? await tx.weekAttendee.deleteMany({ where: { weekId } })
    : { count: 0 };

  if (plan.updateStatus) {
    await tx.week.update({ where: { id: weekId }, data: { status: plan.resultStatus } });
  }

  return {
    status: plan.resultStatus,
    deleted: {
      teams: teamResult.count,
      matches: matchResult.count,
      sets: setCount,
      mvps: mvpResult.count,
      attendees: attendeeResult.count,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/weekResetService.orchestration.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekResetService.ts src/lib/weekResetService.orchestration.test.ts
git commit -m "feat: add resetWeekData service with orchestration tests"
```

---

### Task 3: `POST /api/admin/weeks/:id/reset` route

**Files:**
- Create: `src/app/api/admin/weeks/[id]/reset/route.ts`

**Interfaces:**
- Consumes: `resetWeekData`, `WeekNotFoundError` from `src/lib/weekResetService.ts` (Task 2); `prisma` singleton from `src/lib/db.ts`.
- Produces: `POST` handler at `/api/admin/weeks/:id/reset`. Response shape:
  ```json
  { "success": true, "weekId": "...", "status": "draft", "deleted": { "teams": 2, "matches": 1, "sets": 2, "mvps": 1, "attendees": 0 } }
  ```
  Task 6's `WeekResetControl` calls this endpoint by URL/body shape only (no shared TS import).

- [ ] **Step 1: Write the route**

```ts
// src/app/api/admin/weeks/[id]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resetWeekData, WeekNotFoundError } from '@/lib/weekResetService';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));

  const removeAttendees = body.removeAttendees ?? false;
  const resetStatus = body.resetStatus ?? false;

  if (typeof removeAttendees !== 'boolean' || typeof resetStatus !== 'boolean') {
    return NextResponse.json(
      { error: 'removeAttendees ve resetStatus boolean olmalı' },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction((tx) =>
      resetWeekData(tx, params.id, { removeAttendees, resetStatus })
    );
    return NextResponse.json({ success: true, weekId: params.id, ...result });
  } catch (err) {
    if (err instanceof WeekNotFoundError) {
      return NextResponse.json({ error: 'Hafta bulunamadı' }, { status: 404 });
    }
    console.error('[POST /api/admin/weeks/:id/reset]', err);
    return NextResponse.json({ error: 'Hafta verileri sıfırlanamadı' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check the route**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/app/api/admin/weeks/[id]/reset/route.ts`

There is no route-level automated test in this project (confirmed: `GET`/`PATCH`/`DELETE` on `src/app/api/admin/weeks/[id]/route.ts` and the `teams`/`mvps` sub-routes have none either — the project's convention is to push logic into `src/lib/*` and unit-test that, which Tasks 1–2 already did). This route is a thin wrapper with no independent logic to unit-test; it gets exercised end-to-end in Task 9's manual UAT once the UI is wired up, using a real authenticated admin session.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/weeks/[id]/reset/route.ts
git commit -m "feat: add POST /api/admin/weeks/:id/reset endpoint"
```

---

### Task 4: Extend `ConfirmDialog` with a `children` slot

**Files:**
- Modify: `src/components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `ConfirmDialogProps.children?: React.ReactNode`, rendered between the `warning` paragraph and the button row. All existing props/behavior unchanged.

- [ ] **Step 1: Add the prop and render it**

In `src/components/ConfirmDialog.tsx`, update the interface (current lines 3-13):

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  details?: { label: string; value: string | number }[];
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}
```

Add `children` to the destructured props (current lines 15-25) and render it after the `warning` block (current line 47), before the button row:

```tsx
export function ConfirmDialog({
  open,
  title,
  details,
  warning,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded shadow-lg max-w-sm w-full p-5">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {details && details.length > 0 && (
          <ul className="text-sm text-slate-700 space-y-1 mb-3">
            {details.map((d) => (
              <li key={d.label} className="flex justify-between">
                <span>{d.label}</span>
                <span className="font-medium">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
        {warning && <p className="text-sm text-red-600 mb-4">{warning}</p>}
        {children}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 rounded border text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1 rounded text-sm text-white ${danger ? 'bg-red-600' : 'bg-slate-900'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and confirm existing usages still compile**

Run: `npx tsc --noEmit`
Expected: no errors. `src/components/WeekRowActions.tsx`'s two `<ConfirmDialog>` usages don't pass `children` — the prop is optional, so nothing breaks.

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfirmDialog.tsx
git commit -m "feat: add optional children slot to ConfirmDialog"
```

---

### Task 5: `WeekResetControl` client component

**Files:**
- Create: `src/components/WeekResetControl.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` from `src/components/ConfirmDialog.tsx` (Task 4); `WEEK_STATUS_LABELS`, `WeekStatus` from `src/lib/constants.ts`; calls `POST /api/admin/weeks/:id/reset` (Task 3).
- Produces:
  ```ts
  interface WeekResetControlProps {
    weekId: string;
    weekDateLabel: string;
    currentStatus: WeekStatus;
    teamCount: number;
    matchCount: number;
    setCount: number;
    mvpCount: number;
    attendeeCount: number;
  }
  export function WeekResetControl(props: WeekResetControlProps): JSX.Element
  ```
  Task 6 imports and renders `<WeekResetControl>` with these exact prop names.

- [ ] **Step 1: Write the component**

```tsx
// src/components/WeekResetControl.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WEEK_STATUS_LABELS, type WeekStatus } from '@/lib/constants';

interface WeekResetControlProps {
  weekId: string;
  weekDateLabel: string;
  currentStatus: WeekStatus;
  teamCount: number;
  matchCount: number;
  setCount: number;
  mvpCount: number;
  attendeeCount: number;
}

export function WeekResetControl({
  weekId,
  weekDateLabel,
  currentStatus,
  teamCount,
  matchCount,
  setCount,
  mvpCount,
  attendeeCount,
}: WeekResetControlProps) {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [removeAttendees, setRemoveAttendees] = useState(false);
  const [resetStatus, setResetStatus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(`/api/admin/weeks/${weekId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeAttendees, resetStatus }),
    });
    setBusy(false);
    setConfirmReset(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Sıfırlama başarısız');
      return;
    }
    setRemoveAttendees(false);
    setResetStatus(true);
    setSuccess('Hafta verileri sıfırlandı.');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        className="text-sm text-red-600 underline"
      >
        Hafta Verilerini Sıfırla
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {success && <span className="text-xs text-green-700">{success}</span>}

      <ConfirmDialog
        open={confirmReset}
        title={`${weekDateLabel} haftasının verileri sıfırlansın mı?`}
        details={[
          { label: 'Takım', value: teamCount },
          { label: 'Maç', value: matchCount },
          { label: 'Set', value: setCount },
          { label: 'MVP kaydı', value: mvpCount },
          { label: 'Katılımcı', value: attendeeCount },
        ]}
        warning={
          resetStatus
            ? 'Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir ve hafta Taslak durumuna alınacaktır. Bu işlem geri alınamaz.'
            : `Bu işlem hafta kaydını ve oyuncuları silmez. Takımlar, maçlar, set skorları ve haftanın oyuncusu temizlenir; hafta durumu değişmeyecek (mevcut: ${WEEK_STATUS_LABELS[currentStatus]}). Bu işlem geri alınamaz.`
        }
        confirmLabel={busy ? 'Sıfırlanıyor…' : 'Verileri Sıfırla'}
        cancelLabel="Vazgeç"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      >
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={removeAttendees}
            onChange={(e) => setRemoveAttendees(e.target.checked)}
          />
          Katılımcıları da temizle
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={resetStatus}
            onChange={(e) => setResetStatus(e.target.checked)}
          />
          Haftayı Taslak durumuna al
        </label>
      </ConfirmDialog>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (component isn't wired into any page yet, so nothing else to verify at this step)

- [ ] **Step 3: Commit**

```bash
git add src/components/WeekResetControl.tsx
git commit -m "feat: add WeekResetControl component"
```

---

### Task 6: Wire `WeekResetControl` into the admin week detail page

**Files:**
- Modify: `src/app/admin/haftalar/[id]/page.tsx`

**Interfaces:**
- Consumes: `WeekResetControl` from `src/components/WeekResetControl.tsx` (Task 5).

- [ ] **Step 1: Add the import and render the control**

In `src/app/admin/haftalar/[id]/page.tsx`, add the import alongside the existing ones (current lines 1-7):

```tsx
import { WeekResetControl } from '@/components/WeekResetControl';
```

Compute `setCount` and render `<WeekResetControl>` right after `<WeekStatusControl>` (current line 26):

```tsx
  const attendeePlayers = week.attendees.map((a) => a.player);
  const setCount = week.matches.reduce(
    (sum, m) => sum + (m.sets as [number, number][]).length,
    0
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{new Date(week.date).toLocaleDateString('tr-TR')} Haftası</h1>
      <WeekStatusControl weekId={week.id} initialStatus={week.status as WeekStatus} />
      <WeekResetControl
        weekId={week.id}
        weekDateLabel={new Date(week.date).toLocaleDateString('tr-TR')}
        currentStatus={week.status as WeekStatus}
        teamCount={week.teams.length}
        matchCount={week.matches.length}
        setCount={setCount}
        mvpCount={week.mvps.length}
        attendeeCount={week.attendees.length}
      />
```

(Everything below — `Katılımcılar`, `TeamBuilder`, `FixtureManager`, `MvpPicker` — stays unchanged.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, log into `/login` as the seeded admin, open `/admin/haftalar/<any week id>`.
Expected: a red "Hafta Verilerini Sıfırla" link appears next to the status dropdown; clicking it opens a dialog titled "`<tarih>` haftasının verileri sıfırlansın mı?" with Takım/Maç/Set/MVP kaydı/Katılımcı counts, both checkboxes ("Katılımcıları da temizle" unchecked, "Haftayı Taslak durumuna al" checked), and "Verileri Sıfırla"/"Vazgeç" buttons. Click "Vazgeç" — dialog closes, nothing changes. Do not confirm yet (full flow is verified in Task 9 against a disposable test week).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/haftalar/[id]/page.tsx
git commit -m "feat: render WeekResetControl on the admin week detail page"
```

---

### Task 7: `TEST_DATABASE_URL` support — `cross-env`, `test:db` script, `.env.example`

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces: `npm run test:db` script; `TEST_DATABASE_URL` documented as a required env var for that script only. No code interface — this is tooling/config.

- [ ] **Step 1: Install `cross-env`**

Run: `npm install --save-dev cross-env`
Expected: `cross-env` appears under `devDependencies` in `package.json` (this repo is developed on Windows; `VAR=value command` shell syntax doesn't work in `cmd.exe`/PowerShell without it).

- [ ] **Step 2: Add the `test:db` script**

In `package.json`, add a new script next to `"test": "vitest run"` (current line 11):

```json
    "test": "vitest run",
    "test:db": "cross-env RUN_DB_TESTS=1 vitest run src/lib/weekResetService.integration.test.ts",
```

- [ ] **Step 3: Document `TEST_DATABASE_URL` in `.env.example`**

Append to `.env.example`:

```
# Only required to run `npm run test:db` (integration tests for the week-reset
# feature). MUST point at a separate database from DATABASE_URL — the test
# suite creates and deletes real rows and refuses to run if the two URLs match.
TEST_DATABASE_URL="postgresql://user:password@host/dbname_test?sslmode=require"
```

- [ ] **Step 4: Verify the script exists and fails safely with no env set**

Run: `npm run test:db`
Expected: the integration test file doesn't exist yet (Task 8), so this will currently fail with "no test files found" — that's expected at this point in the plan. Just confirm the command itself runs (no npm script-resolution error) rather than checking test output.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add test:db script and TEST_DATABASE_URL docs"
```

---

### Task 8: Integration test — real Postgres, isolated fixtures, real rollback

**Files:**
- Create: `src/lib/weekResetService.integration.test.ts`

**Interfaces:**
- Consumes: `resetWeekData` from `src/lib/weekResetService.ts` (Task 2); `TEST_DATABASE_URL`, `RUN_DB_TESTS`, `DATABASE_URL` env vars (Task 7).
- Produces: nothing consumed by later tasks — this is the terminal test file for the service.

- [ ] **Step 1: Write the integration test file**

```ts
// src/lib/weekResetService.integration.test.ts
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { resetWeekData } from './weekResetService';

const RUN = process.env.RUN_DB_TESTS === '1';
const TEST_DB = process.env.TEST_DATABASE_URL;
const canRun = RUN && !!TEST_DB && TEST_DB !== process.env.DATABASE_URL;

describe.skipIf(!canRun)('resetWeekData (integration)', () => {
  const prismaTest = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
  const prefix = `test-week-reset-${randomUUID()}`;
  const createdWeekIds: string[] = [];
  const createdPlayerIds: string[] = [];

  afterEach(async () => {
    for (const weekId of createdWeekIds.splice(0)) {
      await prismaTest.week.delete({ where: { id: weekId } }).catch(() => {});
    }
    for (const playerId of createdPlayerIds.splice(0)) {
      await prismaTest.player.delete({ where: { id: playerId } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await prismaTest.$disconnect();
  });

  async function createFixtureWeek(status: string) {
    const week = await prismaTest.week.create({ data: { date: new Date('2026-01-01'), status } });
    createdWeekIds.push(week.id);

    const player1 = await prismaTest.player.create({ data: { name: `${prefix}-player-1`, level: 3 } });
    const player2 = await prismaTest.player.create({ data: { name: `${prefix}-player-2`, level: 3 } });
    createdPlayerIds.push(player1.id, player2.id);

    await prismaTest.weekAttendee.createMany({
      data: [
        { weekId: week.id, playerId: player1.id },
        { weekId: week.id, playerId: player2.id },
      ],
    });

    const teamA = await prismaTest.team.create({
      data: { weekId: week.id, name: `${prefix}-team-a`, players: { create: [{ playerId: player1.id }] } },
    });
    const teamB = await prismaTest.team.create({
      data: { weekId: week.id, name: `${prefix}-team-b`, players: { create: [{ playerId: player2.id }] } },
    });

    await prismaTest.match.create({
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

    await prismaTest.weeklyMvp.create({ data: { weekId: week.id, playerId: player1.id } });

    return { week, player1, player2 };
  }

  it('resets a week with teams and matches, returns real deleted counts', async () => {
    const { week } = await createFixtureWeek('completed');

    const result = await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: false, resetStatus: false })
    );

    expect(result.deleted).toEqual({ teams: 2, matches: 1, sets: 2, mvps: 1, attendees: 0 });

    expect(await prismaTest.team.count({ where: { weekId: week.id } })).toBe(0);
    expect(await prismaTest.match.count({ where: { weekId: week.id } })).toBe(0);
    expect(await prismaTest.weeklyMvp.count({ where: { weekId: week.id } })).toBe(0);
    expect(await prismaTest.weekAttendee.count({ where: { weekId: week.id } })).toBe(2);
  });

  it('resets an archived week: status becomes draft, the Week row survives', async () => {
    const { week } = await createFixtureWeek('archived');

    const result = await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: false, resetStatus: true })
    );

    expect(result.status).toBe('draft');
    const reloaded = await prismaTest.week.findUnique({ where: { id: week.id } });
    expect(reloaded?.status).toBe('draft');
    expect(reloaded?.id).toBe(week.id);
  });

  it('leaves Player rows completely untouched', async () => {
    const { week, player1, player2 } = await createFixtureWeek('completed');
    const before = await prismaTest.player.findMany({ where: { id: { in: [player1.id, player2.id] } } });

    await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: true, resetStatus: true })
    );

    const after = await prismaTest.player.findMany({ where: { id: { in: [player1.id, player2.id] } } });
    expect(after).toEqual(before);
  });

  it('does not touch another week\'s data', async () => {
    const { week: targetWeek } = await createFixtureWeek('completed');
    const { week: otherWeek } = await createFixtureWeek('completed');

    await prismaTest.$transaction((tx) =>
      resetWeekData(tx, targetWeek.id, { removeAttendees: true, resetStatus: true })
    );

    expect(await prismaTest.team.count({ where: { weekId: otherWeek.id } })).toBe(2);
    expect(await prismaTest.match.count({ where: { weekId: otherWeek.id } })).toBe(1);
    expect(await prismaTest.weeklyMvp.count({ where: { weekId: otherWeek.id } })).toBe(1);
    expect(await prismaTest.weekAttendee.count({ where: { weekId: otherWeek.id } })).toBe(2);
  });

  it('preserves WeekAttendee rows when removeAttendees is false', async () => {
    const { week } = await createFixtureWeek('completed');
    await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: false, resetStatus: false })
    );
    expect(await prismaTest.weekAttendee.count({ where: { weekId: week.id } })).toBe(2);
  });

  it('deletes WeekAttendee rows when removeAttendees is true', async () => {
    const { week } = await createFixtureWeek('completed');
    await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: true, resetStatus: false })
    );
    expect(await prismaTest.weekAttendee.count({ where: { weekId: week.id } })).toBe(0);
  });

  it('is idempotent on a second reset', async () => {
    const { week } = await createFixtureWeek('completed');
    await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: true, resetStatus: true })
    );

    const second = await prismaTest.$transaction((tx) =>
      resetWeekData(tx, week.id, { removeAttendees: true, resetStatus: true })
    );

    expect(second.deleted).toEqual({ teams: 0, matches: 0, sets: 0, mvps: 0, attendees: 0 });
    expect(second.status).toBe('draft');
  });

  it('rolls back every delete when the surrounding transaction fails', async () => {
    const { week } = await createFixtureWeek('completed');

    await expect(
      prismaTest.$transaction(async (tx) => {
        await resetWeekData(tx, week.id, { removeAttendees: true, resetStatus: true });
        throw new Error('forced rollback for test');
      })
    ).rejects.toThrow('forced rollback for test');

    expect(await prismaTest.team.count({ where: { weekId: week.id } })).toBe(2);
    expect(await prismaTest.match.count({ where: { weekId: week.id } })).toBe(1);
    expect(await prismaTest.weeklyMvp.count({ where: { weekId: week.id } })).toBe(1);
    expect(await prismaTest.weekAttendee.count({ where: { weekId: week.id } })).toBe(2);
    const reloaded = await prismaTest.week.findUnique({ where: { id: week.id } });
    expect(reloaded?.status).toBe('completed');
  });
});
```

- [ ] **Step 2: Confirm the suite is skipped without env vars set**

Run: `npx vitest run src/lib/weekResetService.integration.test.ts`
Expected: PASS with all tests reported as **skipped** (no `TEST_DATABASE_URL`/`RUN_DB_TESTS` set) — this proves the safety gate works before any real DB is involved.

- [ ] **Step 3: Confirm `npm test` never runs this file with real DB access**

Run: `npm test`
Expected: `weekResetService.integration.test.ts` shows as skipped (same as Step 2); no other test's pass/fail status changes.

- [ ] **Step 4: Provision a real test database and run the suite against it**

This step requires a real, disposable PostgreSQL database the user controls
(a separate Postgres database/schema from the one in `.env`/`.env.local`,
e.g. created via the same provider used for `DATABASE_URL`, or a local
Postgres instance). Ask the user to supply a `TEST_DATABASE_URL` connection
string before proceeding — do not fabricate or guess one, and do not point
it at `DATABASE_URL`. Once available:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma  # apply schema to the test DB (run with TEST_DATABASE_URL exported as DATABASE_URL for this one command, or via --url if supported by the installed Prisma version)
npm run test:db
```

(Set `TEST_DATABASE_URL` — and only that variable — in the shell environment or `.env.local` before running `npm run test:db`; `cross-env` in the script only sets `RUN_DB_TESTS`.)

Expected: PASS (8 tests), all fixture rows cleaned up (`afterEach` removes
every `test-week-reset-*` week/player it created); re-running the command
immediately after should show zero leftover rows in the test database.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weekResetService.integration.test.ts
git commit -m "test: add real-DB integration tests for resetWeekData"
```

---

### Task 9: Manual UAT — full flow against a disposable week

**Files:** none (verification only)

**Interfaces:** none — this task exercises Tasks 3–6 end-to-end through the browser.

- [ ] **Step 1: Start the dev server and create a disposable test week**

Run: `npm run dev`. Log in as admin, go to `/admin/haftalar/yeni`, create a new week (any future date, e.g. `2026-08-14`) with 4+ attendees. Build 2 teams via the team builder, add 1 match with a completed score (2 sets), assign an MVP.

- [ ] **Step 2: Reset with default options ("koru" katılımcılar, "Taslak"a al)**

On `/admin/haftalar/<new-week-id>`, click "Hafta Verilerini Sıfırla". Confirm the dialog shows the correct counts (2 takım, 1 maç, 2 set, 1 MVP kaydı, N katılımcı) and the draft-status warning text. Leave both checkboxes at their defaults (katılımcıları temizle **off**, Taslak durumuna al **on**) and click "Verileri Sıfırla".

Expected: dialog closes immediately; a green "Hafta verileri sıfırlandı." message appears; page auto-refreshes; team/match/MVP sections now show empty state; the status dropdown now shows "Taslak"; the attendee list (`Katılımcılar (N)`) is **unchanged**.

- [ ] **Step 3: Verify admin list and public homepage reflect the draft status**

Go to `/admin/haftalar` (default "Aktif" filter) — the reset week appears with status "Taslak" (this filter is `status !== 'archived'`, so drafts show — `src/app/admin/haftalar/page.tsx:15`). Go to the public homepage (`/`) — the reset week must **not** appear as the featured/next week, since `getNextWeekSummary` excludes `status: { notIn: ['draft', 'archived'] }` — i.e. drafts are excluded (`src/lib/weekView.ts:39`).

- [ ] **Step 4: Verify "katılımcıları da temizle" checkbox**

Rebuild teams/match/MVP on the same test week (repeat Step 1's data entry). Click "Hafta Verilerini Sıfırla" again, this time check "Katılımcıları da temizle", leave "Haftayı Taslak durumuna al" checked, confirm.

Expected: same as Step 2, plus `Katılımcılar (0)` — the attendee list is now empty.

- [ ] **Step 5: Verify idempotent re-reset**

With the week now fully empty, click "Hafta Verilerini Sıfırla" once more and confirm with default options.

Expected: succeeds again (green success message), no error, all counts in the confirmation dialog were `0` before confirming.

- [ ] **Step 6: Clean up the disposable week**

Delete the test week created in Step 1 via the "Sil" action on `/admin/haftalar` (safe now — it has no completed matches, so `canDeleteWeek` allows it).

No commit for this task — it's verification only, confirming the feature described in the spec's acceptance behavior (§9–§11) actually works end-to-end.
