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
    weekAbsence: { deleteMany: vi.fn() },
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
  tx.weekAbsence.deleteMany.mockResolvedValue({ count: 2 });
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
    expect(tx.weekAbsence.deleteMany).toHaveBeenCalledWith({ where: { weekId: 'week-1' } });
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
