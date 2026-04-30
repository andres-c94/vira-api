import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, MissionStatus, ProgramStatus, UserProgram } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateProgramDay,
  levelFromTotalXp,
  localDateForProgramDay,
  progressPercent,
  toLocalDateString
} from './program-sync.utils';

@Injectable()
export class ProgramSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService
  ) {}

  async syncActiveProgram(userId: string): Promise<{
    userProgram: (UserProgram & {
      program: { id: string; title: string; totalDays: number };
      missionExecutions: Array<{ programDay: number; status: MissionStatus; socialMediaMinutes: number | null }>;
      moods: Array<{ programDay: number; mood: string }>;
    }) | null;
    justCompleted: boolean;
    localDate: string | null;
    calculatedProgramDay: number | null;
  }> {
    const activeUserProgram = await this.prisma.userProgram.findFirst({
      where: { userId, status: ProgramStatus.ACTIVE },
      include: {
        program: {
          select: { id: true, title: true, totalDays: true }
        },
        missionExecutions: {
          select: { programDay: true, status: true, socialMediaMinutes: true }
        },
        moods: {
          select: { programDay: true, mood: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeUserProgram) {
      return {
        userProgram: null,
        justCompleted: false,
        localDate: null,
        calculatedProgramDay: null
      };
    }

    const now = new Date();
    const calculatedDay = calculateProgramDay(activeUserProgram.startedAt, now, activeUserProgram.lockedTimezone);
    const localDate = toLocalDateString(now, activeUserProgram.lockedTimezone);
    const expiredDayUpperBound = Math.min(calculatedDay - 1, activeUserProgram.program.totalDays);

    await this.prisma.$transaction(async (tx) => {
      for (let day = 1; day <= expiredDayUpperBound; day += 1) {
        const existingExecution = await tx.missionExecution.findUnique({
          where: {
            userProgramId_programDay: {
              userProgramId: activeUserProgram.id,
              programDay: day
            }
          }
        });

        if (existingExecution) {
          continue;
        }

        const mission = await tx.programMission.findUniqueOrThrow({
          where: {
            programId_dayNumber: {
              programId: activeUserProgram.programId,
              dayNumber: day
            }
          }
        });

        await tx.missionExecution.create({
          data: {
            userProgramId: activeUserProgram.id,
            programMissionId: mission.id,
            programDay: day,
            localDate: localDateForProgramDay(activeUserProgram.startedAt, activeUserProgram.lockedTimezone, day),
            status: MissionStatus.FAILED,
            failureReason: 'SYSTEM_TIMEOUT',
            isAutoFailed: true,
            failedAt: now
          }
        });

        await this.analyticsService.trackEvent({
          tx,
          userId,
          programId: activeUserProgram.programId,
          programMissionId: mission.id,
          userProgramId: activeUserProgram.id,
          eventType: AnalyticsEventType.MISSION_FAILED,
          programDay: day,
          localDate: localDateForProgramDay(activeUserProgram.startedAt, activeUserProgram.lockedTimezone, day),
          payload: {
            reason: 'SYSTEM_TIMEOUT',
            isAutoFailed: true,
            timestamp: now.toISOString()
          }
        });
      }

      const executions = await tx.missionExecution.findMany({
        where: { userProgramId: activeUserProgram.id },
        include: { programMission: true },
        orderBy: { programDay: 'asc' }
      });

      const totalXP = executions
        .filter((execution) => execution.status === MissionStatus.COMPLETED)
        .reduce((sum, execution) => sum + execution.programMission.xpReward, 0);

      let currentStreak = 0;
      for (let index = executions.length - 1; index >= 0; index -= 1) {
        if (executions[index].status !== MissionStatus.COMPLETED) {
          break;
        }
        currentStreak += 1;
      }

      const boundedProgramDay = Math.min(calculatedDay, activeUserProgram.program.totalDays);
      const nextStatus = calculatedDay > activeUserProgram.program.totalDays ? ProgramStatus.COMPLETED : ProgramStatus.ACTIVE;

      await tx.userProgram.update({
        where: { id: activeUserProgram.id },
        data: {
          totalXP,
          level: levelFromTotalXp(totalXP),
          currentStreak,
          currentProgramDay: boundedProgramDay,
          status: nextStatus,
          completedAt: nextStatus === ProgramStatus.COMPLETED ? now : null,
          lastSyncedAt: now
        }
      });
    });

    const syncedUserProgram = await this.prisma.userProgram.findUniqueOrThrow({
      where: { id: activeUserProgram.id },
      include: {
        program: {
          select: { id: true, title: true, totalDays: true }
        },
        missionExecutions: {
          select: { programDay: true, status: true, socialMediaMinutes: true }
        },
        moods: {
          select: { programDay: true, mood: true }
        }
      }
    });

    return {
      userProgram: syncedUserProgram,
      justCompleted: activeUserProgram.status === ProgramStatus.ACTIVE && syncedUserProgram.status === ProgramStatus.COMPLETED,
      localDate,
      calculatedProgramDay: calculatedDay
    };
  }

  getProgressSnapshot(userProgram: {
    currentProgramDay: number;
    program: { totalDays: number };
    missionExecutions: Array<{ status: MissionStatus; socialMediaMinutes: number | null }>;
    totalXP: number;
    level: number;
    currentStreak: number;
  }) {
    const completedDaysCount = userProgram.missionExecutions.filter((execution) => execution.status === MissionStatus.COMPLETED).length;
    const failedDaysCount = userProgram.missionExecutions.filter((execution) => execution.status === MissionStatus.FAILED).length;
    const completedSocialMedia = userProgram.missionExecutions.filter(
      (execution) => execution.status === MissionStatus.COMPLETED && execution.socialMediaMinutes !== null
    );

    const averageSocialMediaMinutes =
      completedSocialMedia.length === 0
        ? null
        : Math.floor(
            completedSocialMedia.reduce((sum, execution) => sum + (execution.socialMediaMinutes ?? 0), 0) /
              completedSocialMedia.length
          );

    return {
      completedDaysCount,
      failedDaysCount,
      totalDays: userProgram.program.totalDays,
      progressPercent: progressPercent(userProgram.currentProgramDay, userProgram.program.totalDays),
      totalXP: userProgram.totalXP,
      level: userProgram.level,
      currentStreak: userProgram.currentStreak,
      averageSocialMediaMinutes
    };
  }
}
