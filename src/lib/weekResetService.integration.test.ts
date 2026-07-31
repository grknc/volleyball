// src/lib/weekResetService.integration.test.ts
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { resetWeekData } from './weekResetService';

const RUN = process.env.RUN_DB_TESTS === '1';
const TEST_DB = process.env.TEST_DATABASE_URL;
const canRun = RUN && !!TEST_DB && TEST_DB !== process.env.DATABASE_URL;

describe.skipIf(!canRun)('resetWeekData (integration)', () => {
  // Fall back to a placeholder URL when TEST_DB is unset so the PrismaClient
  // constructor never throws during test collection (which runs even for
  // skipped suites); the client is never used unless canRun is true.
  const prismaTest = new PrismaClient({ datasources: { db: { url: TEST_DB ?? 'postgresql://skip:skip@localhost:5432/skip' } } });
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
