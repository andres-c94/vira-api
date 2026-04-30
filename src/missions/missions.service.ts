import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AnalyticsEventType, FailureReason, MissionStatus, Mood, ProgramStatus, Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { localDateForProgramDay } from '../program-sync/program-sync.utils';
import { MoodService } from '../mood/mood.service';
import { CompleteMissionDto } from './dto/complete-mission.dto';
import { FailMissionDto } from './dto/fail-mission.dto';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programSyncService: ProgramSyncService,
    private readonly analyticsService: AnalyticsService,
    private readonly moodService: MoodService
  ) {}

  async completeTodayMission(userId: string, dto: CompleteMissionDto) {
    const synced = await this.getValidatedActiveProgram(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.missionExecution.findUnique({
        where: {
          userProgramId_programDay: {
            userProgramId: synced.userProgram.id,
            programDay: synced.userProgram.currentProgramDay
          }
        }
      });

      if (existing) {
        throw new ConflictException('Mission already finalized');
      }

      const mission = await tx.programMission.findUniqueOrThrow({
        where: {
          programId_dayNumber: {
            programId: synced.userProgram.programId,
            dayNumber: synced.userProgram.currentProgramDay
          }
        }
      });

      const localDate = localDateForProgramDay(
        synced.userProgram.startedAt,
        synced.userProgram.lockedTimezone,
        synced.userProgram.currentProgramDay
      );

      const execution = await tx.missionExecution.create({
        data: {
          userProgramId: synced.userProgram.id,
          programMissionId: mission.id,
          programDay: synced.userProgram.currentProgramDay,
          localDate,
          status: MissionStatus.COMPLETED,
          durationMinutes: dto.durationMinutes,
          difficultyRating: dto.difficultyRating,
          socialMediaMinutes: dto.socialMediaMinutes,
          reflection: dto.reflection,
          completedAt: new Date()
        }
      });

      if (dto.mood) {
        await this.moodService.recordMood(tx, {
          userProgramId: synced.userProgram.id,
          programDay: synced.userProgram.currentProgramDay,
          localDate,
          mood: dto.mood
        });
      }

      return { execution, mission, localDate };
    });

    await this.analyticsService.trackEvent({
      userId,
      programId: synced.userProgram.programId,
      programMissionId: result.mission.id,
      userProgramId: synced.userProgram.id,
      eventType: AnalyticsEventType.MISSION_COMPLETED,
      programDay: synced.userProgram.currentProgramDay,
      localDate: result.localDate,
      payload: {
        durationMinutes: dto.durationMinutes,
        difficultyRating: dto.difficultyRating,
        socialMediaMinutes: dto.socialMediaMinutes,
        timestamp: result.execution.completedAt?.toISOString() ?? new Date().toISOString()
      }
    });

    await this.programSyncService.syncActiveProgram(userId);
    return result.execution;
  }

  async failTodayMission(userId: string, dto: FailMissionDto) {
    if (dto.reason === FailureReason.SYSTEM_TIMEOUT) {
      throw new ConflictException('SYSTEM_TIMEOUT is reserved for automatic failures');
    }

    const synced = await this.getValidatedActiveProgram(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.missionExecution.findUnique({
        where: {
          userProgramId_programDay: {
            userProgramId: synced.userProgram.id,
            programDay: synced.userProgram.currentProgramDay
          }
        }
      });

      if (existing) {
        throw new ConflictException('Mission already finalized');
      }

      const mission = await tx.programMission.findUniqueOrThrow({
        where: {
          programId_dayNumber: {
            programId: synced.userProgram.programId,
            dayNumber: synced.userProgram.currentProgramDay
          }
        }
      });

      const localDate = localDateForProgramDay(
        synced.userProgram.startedAt,
        synced.userProgram.lockedTimezone,
        synced.userProgram.currentProgramDay
      );

      const execution = await tx.missionExecution.create({
        data: {
          userProgramId: synced.userProgram.id,
          programMissionId: mission.id,
          programDay: synced.userProgram.currentProgramDay,
          localDate,
          status: MissionStatus.FAILED,
          failureReason: dto.reason,
          isAutoFailed: false,
          failedAt: new Date()
        }
      });

      if (dto.mood) {
        await this.moodService.recordMood(tx, {
          userProgramId: synced.userProgram.id,
          programDay: synced.userProgram.currentProgramDay,
          localDate,
          mood: dto.mood
        });
      }

      return { execution, mission, localDate };
    });

    await this.analyticsService.trackEvent({
      userId,
      programId: synced.userProgram.programId,
      programMissionId: result.mission.id,
      userProgramId: synced.userProgram.id,
      eventType: AnalyticsEventType.MISSION_FAILED,
      programDay: synced.userProgram.currentProgramDay,
      localDate: result.localDate,
      payload: {
        reason: dto.reason,
        isAutoFailed: false,
        timestamp: result.execution.failedAt?.toISOString() ?? new Date().toISOString()
      }
    });

    await this.programSyncService.syncActiveProgram(userId);
    return result.execution;
  }

  async recordMood(userId: string, mood: Mood) {
    const synced = await this.getValidatedActiveProgram(userId);
    const localDate = localDateForProgramDay(
      synced.userProgram.startedAt,
      synced.userProgram.lockedTimezone,
      synced.userProgram.currentProgramDay
    );

    return this.prisma.$transaction((tx) =>
      this.moodService.recordMood(tx, {
        userProgramId: synced.userProgram.id,
        programDay: synced.userProgram.currentProgramDay,
        localDate,
        mood
      })
    );
  }

  private async getValidatedActiveProgram(userId: string): Promise<{
    userProgram: Prisma.UserProgramGetPayload<{
      include: { program: true };
    }>;
  }> {
    const synced = await this.programSyncService.syncActiveProgram(userId);
    if (!synced.userProgram) {
      throw new NotFoundException('No active program');
    }

    const userProgram = await this.prisma.userProgram.findUniqueOrThrow({
      where: { id: synced.userProgram.id },
      include: { program: true }
    });

    if (userProgram.status === ProgramStatus.COMPLETED) {
      throw new ConflictException('Program is already completed');
    }

    if (userProgram.currentProgramDay < 1 || userProgram.currentProgramDay > userProgram.program.totalDays) {
      throw new ConflictException('Program day is outside active range');
    }

    return { userProgram };
  }
}
