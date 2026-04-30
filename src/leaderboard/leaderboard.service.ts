import { Injectable } from '@nestjs/common';
import { AnalyticsEventType, MissionStatus, Prisma, ProgramStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { toLocalDateString } from '../program-sync/program-sync.utils';
import { UpdateLeaderboardProfileDto } from './dto/update-leaderboard-profile.dto';

const RESET_PROGRAM_SLUG = 'reset-dopamina-14-dias';

type TodayStatus =
  | 'COMPLETED_TODAY'
  | 'PENDING_TODAY'
  | 'FAILED_TODAY'
  | 'INACTIVE_TODAY'
  | 'PROGRAM_COMPLETED';

type RankedEntry = {
  userId: string;
  position: number;
  displayName: string;
  isCurrentUser: boolean;
  currentStreak: number;
  completedDaysCount: number;
  failedDaysCount: number;
  totalXP: number;
  level: number;
  todayStatus: TodayStatus;
  impulseTodayXp: number;
  impulseBlocksCompletedToday: number;
  impulseActionsCompletedToday: number;
  startedAt: Date;
};

type SelectedUserProgram = {
  id: string;
  userId: string;
  startedAt: Date;
  status: ProgramStatus;
  currentProgramDay: number;
  currentStreak: number;
  totalXP: number;
  level: number;
  lockedTimezone: string;
  missionExecutions: Array<{
    programDay: number;
    status: MissionStatus;
  }>;
  analyticsEvents: Array<{
    localDate: string | null;
  }>;
};

type LeaderboardUserRow = {
  id: string;
  displayName: string | null;
  globalLeaderboardOptIn: boolean;
};

type ImpulseStats = {
  impulseTodayXp: number;
  impulseBlocksCompletedToday: number;
  impulseActionsCompletedToday: number;
};

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programSyncService: ProgramSyncService
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.getLeaderboardUser(userId);

    return this.toProfileResponse(user);
  }

  async updateMyProfile(userId: string, dto: UpdateLeaderboardProfileDto) {
    const [user] = await this.prisma.$queryRaw<LeaderboardUserRow[]>`
      UPDATE "User"
      SET
        "globalLeaderboardOptIn" = ${dto.globalLeaderboardOptIn},
        "displayName" = ${dto.displayName ?? null},
        "updatedAt" = NOW()
      WHERE "id" = ${userId}::uuid
      RETURNING "id", "displayName", "globalLeaderboardOptIn"
    `;

    return this.toProfileResponse(user);
  }

  async getGlobalLeaderboard(userId: string) {
    await this.programSyncService.syncActiveProgram(userId);

    const currentUser = await this.getLeaderboardUser(userId);

    if (!currentUser.globalLeaderboardOptIn) {
      return {
        enabled: false,
        message: 'Global leaderboard is disabled for this user'
      };
    }

    const resetProgram = await this.prisma.program.findUniqueOrThrow({
      where: { slug: RESET_PROGRAM_SLUG },
      select: { id: true }
    });

    const users = await this.prisma.$queryRaw<Array<{ id: string; displayName: string | null }>>`
      SELECT "id", "displayName"
      FROM "User"
      WHERE "globalLeaderboardOptIn" = true
        AND EXISTS (
          SELECT 1
          FROM "UserProgram"
          WHERE "UserProgram"."userId" = "User"."id"
            AND "UserProgram"."programId" = ${resetProgram.id}::uuid
        )
    `;

    const userPrograms = users.length
      ? await this.prisma.userProgram.findMany({
          where: {
            programId: resetProgram.id,
            userId: { in: users.map((user) => user.id) }
          },
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            userId: true,
            startedAt: true,
            status: true,
            currentProgramDay: true,
            currentStreak: true,
            totalXP: true,
            level: true,
            lockedTimezone: true,
            missionExecutions: {
              select: {
                programDay: true,
                status: true
              }
            },
            analyticsEvents: {
              where: { eventType: AnalyticsEventType.DAY_OPENED },
              select: { localDate: true }
            }
          }
        })
      : [];

    const now = new Date();
    const userProgramsByUserId = new Map<string, SelectedUserProgram[]>();
    for (const userProgram of userPrograms) {
      const existing = userProgramsByUserId.get(userProgram.userId) ?? [];
      existing.push(userProgram);
      userProgramsByUserId.set(userProgram.userId, existing);
    }

    const selectedPrograms = users
      .map((user) => {
        const selected = this.selectUserProgram(userProgramsByUserId.get(user.id) ?? []);
        return selected ? { userId: user.id, displayName: user.displayName, userProgram: selected } : null;
      })
      .filter(
        (
          entry
        ): entry is {
          userId: string;
          displayName: string | null;
          userProgram: SelectedUserProgram;
        } => entry !== null
      );

    const impulseStatsByUserProgramId = await this.buildImpulseStatsMap(selectedPrograms.map((entry) => entry.userProgram), now);

    const ranked = selectedPrograms
      .map((entry) =>
        this.buildRankedEntry(
          entry.userId,
          entry.displayName,
          entry.userProgram,
          impulseStatsByUserProgramId.get(entry.userProgram.id) ?? {
            impulseTodayXp: 0,
            impulseBlocksCompletedToday: 0,
            impulseActionsCompletedToday: 0
          },
          userId,
          now
        )
      )
      .filter((entry): entry is RankedEntry => entry !== null)
      .sort((left, right) => {
        if (right.currentStreak !== left.currentStreak) {
          return right.currentStreak - left.currentStreak;
        }

        if (right.completedDaysCount !== left.completedDaysCount) {
          return right.completedDaysCount - left.completedDaysCount;
        }

        if (right.impulseBlocksCompletedToday !== left.impulseBlocksCompletedToday) {
          return right.impulseBlocksCompletedToday - left.impulseBlocksCompletedToday;
        }

        if (right.impulseActionsCompletedToday !== left.impulseActionsCompletedToday) {
          return right.impulseActionsCompletedToday - left.impulseActionsCompletedToday;
        }

        if (right.totalXP !== left.totalXP) {
          return right.totalXP - left.totalXP;
        }

        if (left.startedAt.getTime() !== right.startedAt.getTime()) {
          return left.startedAt.getTime() - right.startedAt.getTime();
        }

        return left.userId.localeCompare(right.userId);
      })
      .map((entry, index) => ({
        ...entry,
        position: index + 1
      }));

    const currentEntry = ranked.find((entry) => entry.userId === userId) ?? null;
    const currentIndex = currentEntry ? ranked.findIndex((entry) => entry.userId === userId) : -1;
    const zone = currentIndex >= 0 ? this.buildZone(ranked, currentIndex) : [];

    return {
      enabled: true,
      userRank: currentEntry ? this.toLeaderboardResponseEntry(currentEntry) : null,
      zone: zone.map((entry) => this.toLeaderboardResponseEntry(entry)),
      top: ranked.slice(0, 5).map((entry) => this.toLeaderboardResponseEntry(entry)),
      summary: {
        totalParticipants: ranked.length,
        completedTodayCount: ranked.filter((entry) => entry.todayStatus === 'COMPLETED_TODAY').length,
        pendingTodayCount: ranked.filter((entry) => entry.todayStatus === 'PENDING_TODAY').length,
        failedTodayCount: ranked.filter((entry) => entry.todayStatus === 'FAILED_TODAY').length,
        impulseActiveTodayCount: ranked.filter((entry) => entry.impulseActionsCompletedToday > 0).length,
        impulseAllBlocksCompletedCount: ranked.filter((entry) => entry.impulseBlocksCompletedToday >= 4).length
      }
    };
  }

  private buildZone(entries: RankedEntry[], currentIndex: number): RankedEntry[] {
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(entries.length, start + 5);
    const adjustedStart = Math.max(0, end - 5);
    return entries.slice(adjustedStart, end);
  }

  private buildRankedEntry(
    userId: string,
    displayName: string | null,
    selectedUserProgram: SelectedUserProgram,
    impulseStats: ImpulseStats,
    currentUserId: string,
    now: Date
  ): RankedEntry | null {
    const completedDaysCount = selectedUserProgram.missionExecutions.filter(
      (execution) => execution.status === MissionStatus.COMPLETED
    ).length;

    const failedDaysCount = selectedUserProgram.missionExecutions.filter(
      (execution) => execution.status === MissionStatus.FAILED
    ).length;

    return {
      userId,
      position: 0,
      displayName: displayName ?? this.buildAlias(userId),
      isCurrentUser: userId === currentUserId,
      currentStreak: selectedUserProgram.currentStreak,
      completedDaysCount,
      failedDaysCount,
      totalXP: selectedUserProgram.totalXP,
      level: selectedUserProgram.level,
      todayStatus: this.resolveTodayStatus(selectedUserProgram, now),
      impulseTodayXp: impulseStats.impulseTodayXp,
      impulseBlocksCompletedToday: impulseStats.impulseBlocksCompletedToday,
      impulseActionsCompletedToday: impulseStats.impulseActionsCompletedToday,
      startedAt: selectedUserProgram.startedAt
    };
  }

  private async buildImpulseStatsMap(userPrograms: SelectedUserProgram[], now: Date) {
    const localDatesByProgramId = new Map<string, string>();
    for (const userProgram of userPrograms) {
      localDatesByProgramId.set(userProgram.id, toLocalDateString(now, userProgram.lockedTimezone));
    }

    const distinctDates = Array.from(new Set(localDatesByProgramId.values()));
    const blocks = userPrograms.length
      ? await this.prisma.$queryRaw<
          Array<{
            userProgramId: string;
            localDate: string;
            status: string;
            xpEarned: number;
            completedActionsCount: number;
          }>
        >`
          SELECT
            ib."userProgramId",
            ib."localDate",
            ib."status",
            ib."xpEarned",
            (
              SELECT COUNT(*)
              FROM "ImpulseAction" ia
              WHERE ia."impulseBlockId" = ib."id"
                AND ia."status" = ${'COMPLETED'}::"ImpulseActionStatus"
            )::int as "completedActionsCount"
          FROM "ImpulseBlock" ib
          WHERE ib."userProgramId" IN (${Prisma.join(userPrograms.map((item) => Prisma.sql`${item.id}::uuid`))})
            AND ib."localDate" IN (${Prisma.join(distinctDates.map((date) => Prisma.sql`${date}`))})
        `
      : [];

    const statsByProgramId = new Map<string, ImpulseStats>();
    for (const userProgram of userPrograms) {
      const localDate = localDatesByProgramId.get(userProgram.id);
      const relevantBlocks = blocks.filter(
        (block) => block.userProgramId === userProgram.id && block.localDate === localDate
      );

      statsByProgramId.set(userProgram.id, {
        impulseTodayXp: relevantBlocks.reduce((sum, block) => sum + block.xpEarned, 0),
        impulseBlocksCompletedToday: relevantBlocks.filter((block) => block.status === 'COMPLETED').length,
        impulseActionsCompletedToday: relevantBlocks.reduce((sum, block) => sum + block.completedActionsCount, 0)
      });
    }

    return statsByProgramId;
  }

  private selectUserProgram(userPrograms: SelectedUserProgram[]): SelectedUserProgram | null {
    const active = userPrograms.find((userProgram) => userProgram.status === ProgramStatus.ACTIVE);
    if (active) {
      return active;
    }

    return userPrograms
      .filter((userProgram) => userProgram.status === ProgramStatus.COMPLETED)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0] ?? null;
  }

  private resolveTodayStatus(userProgram: SelectedUserProgram, now: Date): TodayStatus {
    if (userProgram.status === ProgramStatus.COMPLETED) {
      return 'PROGRAM_COMPLETED';
    }

    const todayLocalDate = toLocalDateString(now, userProgram.lockedTimezone);
    const currentExecution = userProgram.missionExecutions.find(
      (execution) => execution.programDay === userProgram.currentProgramDay
    );

    if (currentExecution?.status === MissionStatus.COMPLETED) {
      return 'COMPLETED_TODAY';
    }

    if (currentExecution?.status === MissionStatus.FAILED) {
      return 'FAILED_TODAY';
    }

    const openedToday = userProgram.analyticsEvents.some((event) => event.localDate === todayLocalDate);
    return openedToday ? 'PENDING_TODAY' : 'INACTIVE_TODAY';
  }

  private toProfileResponse(user: {
    id: string;
    globalLeaderboardOptIn: boolean;
    displayName: string | null;
  }) {
    return {
      globalLeaderboardOptIn: user.globalLeaderboardOptIn,
      displayName: user.displayName,
      publicAlias: user.displayName ?? this.buildAlias(user.id)
    };
  }

  private toLeaderboardResponseEntry(entry: RankedEntry) {
    return {
      position: entry.position,
      displayName: entry.displayName,
      isCurrentUser: entry.isCurrentUser,
      currentStreak: entry.currentStreak,
      completedDaysCount: entry.completedDaysCount,
      failedDaysCount: entry.failedDaysCount,
      totalXP: entry.totalXP,
      level: entry.level,
      todayStatus: entry.todayStatus,
      impulseTodayXp: entry.impulseTodayXp,
      impulseBlocksCompletedToday: entry.impulseBlocksCompletedToday,
      impulseActionsCompletedToday: entry.impulseActionsCompletedToday
    };
  }

  private buildAlias(userId: string): string {
    const stableNumber =
      Array.from(userId).reduce((accumulator, character) => {
        return (accumulator * 31 + character.charCodeAt(0)) % 9000;
      }, 0) + 1000;

    return `Aventurero #${stableNumber}`;
  }

  private async getLeaderboardUser(userId: string): Promise<LeaderboardUserRow> {
    const [user] = await this.prisma.$queryRaw<LeaderboardUserRow[]>`
      SELECT "id", "displayName", "globalLeaderboardOptIn"
      FROM "User"
      WHERE "id" = ${userId}::uuid
      LIMIT 1
    `;

    return user;
  }
}
