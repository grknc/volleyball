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
  if (plan.removeAttendees) {
    // "Gelmiyorum" bildirimleri de katılım verisidir; birlikte temizlenir.
    await tx.weekAbsence.deleteMany({ where: { weekId } });
  }

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
