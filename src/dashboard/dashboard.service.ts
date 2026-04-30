import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, MissionStatus, ProgramStatus } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { MissionExecutionApiStatus } from '../common.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programSyncService: ProgramSyncService,
    private readonly analyticsService: AnalyticsService
  ) {}

  async getToday(userId: string) {
    const synced = await this.programSyncService.syncActiveProgram(userId);
    if (!synced.userProgram) {
      return {
        program: null,
        message: 'No active program'
      };
    }

    if (synced.localDate) {
      await this.analyticsService.trackEvent({
        userId,
        programId: synced.userProgram.programId,
        userProgramId: synced.userProgram.id,
        eventType: AnalyticsEventType.DAY_OPENED,
        programDay: synced.userProgram.currentProgramDay,
        localDate: synced.localDate,
        payload: {
          currentDay: synced.userProgram.currentProgramDay,
          timestamp: new Date().toISOString()
        }
      });
    }

    const missionExecution = await this.prisma.missionExecution.findUnique({
      where: {
        userProgramId_programDay: {
          userProgramId: synced.userProgram.id,
          programDay: synced.userProgram.currentProgramDay
        }
      }
    });

    const mood = await this.prisma.dailyMood.findUnique({
      where: {
        userProgramId_programDay: {
          userProgramId: synced.userProgram.id,
          programDay: synced.userProgram.currentProgramDay
        }
      }
    });

    const progress = this.programSyncService.getProgressSnapshot(synced.userProgram);

    if (synced.userProgram.status === ProgramStatus.COMPLETED) {
      return {
        program: synced.userProgram.program,
        programStatus: ProgramStatus.COMPLETED,
        programDay: synced.userProgram.currentProgramDay,
        mission: null,
        missionExecutionStatus: null,
        missionExecution: null,
        totalXP: synced.userProgram.totalXP,
        level: synced.userProgram.level,
        currentStreak: synced.userProgram.currentStreak,
        progressPercent: 100,
        mood: mood?.mood ?? null,
        completedDaysCount: progress.completedDaysCount,
        failedDaysCount: progress.failedDaysCount
      };
    }

    const mission = await this.prisma.programMission.findUniqueOrThrow({
      where: {
        programId_dayNumber: {
          programId: synced.userProgram.programId,
          dayNumber: synced.userProgram.currentProgramDay
        }
      }
    });

    const missionExecutionStatus: MissionExecutionApiStatus = missionExecution?.status ?? 'PENDING';

    return {
      program: synced.userProgram.program,
      programStatus: synced.userProgram.status,
      programDay: synced.userProgram.currentProgramDay,
      mission: {
        id: mission.id,
        dayNumber: mission.dayNumber,
        title: mission.title,
        description: mission.description,
        structuralDifficulty: mission.structuralDifficulty,
        xpReward: mission.xpReward
      },
      missionExecutionStatus,
      missionExecution,
      totalXP: synced.userProgram.totalXP,
      level: synced.userProgram.level,
      currentStreak: synced.userProgram.currentStreak,
      progressPercent: progress.progressPercent,
      mood: mood?.mood ?? null,
      completedDaysCount: progress.completedDaysCount,
      failedDaysCount: progress.failedDaysCount
    };
  }
}
