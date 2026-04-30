import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateProgramDay } from '../program-sync/program-sync.utils';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(data: {
    tx?: Prisma.TransactionClient;
    userId: string;
    programId?: string | null;
    programMissionId?: string | null;
    userProgramId?: string | null;
    eventType: AnalyticsEventType;
    programDay?: number | null;
    localDate?: string | null;
    payload: Prisma.InputJsonValue;
  }) {
    const client = data.tx ?? this.prisma;

    if (
      data.eventType === AnalyticsEventType.DAY_OPENED &&
      data.userProgramId &&
      data.localDate
    ) {
      const existing = await client.analyticsEvent.findFirst({
        where: {
          userProgramId: data.userProgramId,
          eventType: AnalyticsEventType.DAY_OPENED,
          localDate: data.localDate
        }
      });

      if (existing) {
        return existing;
      }
    }

    return client.analyticsEvent.create({
      data: {
        userId: data.userId,
        programId: data.programId ?? null,
        programMissionId: data.programMissionId ?? null,
        userProgramId: data.userProgramId ?? null,
        eventType: data.eventType,
        programDay: data.programDay ?? null,
        localDate: data.localDate ?? null,
        payload: data.payload
      }
    });
  }

  async getProgramSummary(programId: string) {
    const userPrograms = await this.prisma.userProgram.findMany({
      where: { programId },
      include: {
        missionExecutions: {
          include: { programMission: true }
        }
      }
    });

    const totalStarted = userPrograms.length;
    const completedDay3 = userPrograms.filter((userProgram) => this.hasCompletedUntilDay(userProgram.missionExecutions, 3)).length;
    const completedDay7 = userPrograms.filter((userProgram) => this.hasCompletedUntilDay(userProgram.missionExecutions, 7)).length;

    let socialMediaSum = 0;
    let socialMediaCount = 0;
    const failedByMission = new Map<string, { title: string; failures: number }>();

    for (const userProgram of userPrograms) {
      for (const execution of userProgram.missionExecutions) {
        if (execution.status === 'COMPLETED' && execution.socialMediaMinutes !== null) {
          socialMediaSum += execution.socialMediaMinutes;
          socialMediaCount += 1;
        }

        if (execution.status === 'FAILED') {
          const mission = failedByMission.get(execution.programMissionId) ?? {
            title: execution.programMission.title,
            failures: 0
          };
          mission.failures += 1;
          failedByMission.set(execution.programMissionId, mission);
        }
      }
    }

    const mostFailedMission = [...failedByMission.entries()]
      .sort((a, b) => b[1].failures - a[1].failures)
      .at(0);

    return {
      startedUsersCount: totalStarted,
      completedDay3Percent: totalStarted === 0 ? 0 : Math.floor((completedDay3 / totalStarted) * 100),
      completedDay7Percent: totalStarted === 0 ? 0 : Math.floor((completedDay7 / totalStarted) * 100),
      mostFailedMission: mostFailedMission
        ? {
            programMissionId: mostFailedMission[0],
            title: mostFailedMission[1].title,
            failures: mostFailedMission[1].failures
          }
        : null,
      averageSocialMediaMinutes: socialMediaCount === 0 ? null : Math.floor(socialMediaSum / socialMediaCount)
    };
  }

  async getProgramByDay(programId: string) {
    const program = await this.prisma.program.findUniqueOrThrow({
      where: { id: programId }
    });
    const userPrograms = await this.prisma.userProgram.findMany({
      where: { programId },
      include: {
        missionExecutions: true
      }
    });

    const failureRateByProgramDay: Record<number, number> = {};
    const firstFailureDropoffByProgramDay: Record<number, number> = {};
    const totalStarted = userPrograms.length;

    for (let day = 1; day <= program.totalDays; day += 1) {
      const activeUsers = userPrograms.filter((userProgram) => {
        const reachedProgramDay = calculateProgramDay(userProgram.startedAt, new Date(), userProgram.lockedTimezone);
        return reachedProgramDay >= day;
      }).length;
      const failedUsers = userPrograms.filter((userProgram) =>
        userProgram.missionExecutions.some((execution) => execution.programDay === day && execution.status === 'FAILED')
      ).length;

      failureRateByProgramDay[day] = activeUsers === 0 ? 0 : Math.floor((failedUsers / activeUsers) * 100);

      const firstFailures = userPrograms.filter((userProgram) => {
        const firstFailedExecution = [...userProgram.missionExecutions]
          .filter((execution) => execution.status === 'FAILED')
          .sort((a, b) => a.programDay - b.programDay)[0];

        return firstFailedExecution?.programDay === day;
      }).length;

      firstFailureDropoffByProgramDay[day] = totalStarted === 0 ? 0 : Math.floor((firstFailures / totalStarted) * 100);
    }

    return {
      completedDay3Percent: totalStarted === 0 ? 0 : Math.floor((userPrograms.filter((userProgram) => this.hasCompletedUntilDay(userProgram.missionExecutions, 3)).length / totalStarted) * 100),
      completedDay7Percent: totalStarted === 0 ? 0 : Math.floor((userPrograms.filter((userProgram) => this.hasCompletedUntilDay(userProgram.missionExecutions, 7)).length / totalStarted) * 100),
      failureRateByProgramDay,
      firstFailureDropoffByProgramDay
    };
  }

  private hasCompletedUntilDay(
    executions: Array<{ programDay: number; status: 'COMPLETED' | 'FAILED' }>,
    day: number
  ): boolean {
    for (let currentDay = 1; currentDay <= day; currentDay += 1) {
      const execution = executions.find((item) => item.programDay === currentDay);
      if (!execution || execution.status !== 'COMPLETED') {
        return false;
      }
    }

    return true;
  }
}
