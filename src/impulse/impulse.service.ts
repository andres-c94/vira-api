import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MissionStatus, Prisma, ProgramStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { CompleteImpulseActionDto } from './dto/complete-impulse-action.dto';
import { GetImpulseTodayQueryDto } from './dto/get-impulse-today-query.dto';
import { IMPULSE_TASKS, ImpulseTaskDefinition } from './impulse-tasks.constants';

const RESET_PROGRAM_SLUG = 'reset-dopamina-14-dias';

const IMPULSE_BLOCKS = [
  { blockIndex: 1, label: 'Impulso 1/4', startTime: '08:00', endTime: '11:00', startMinutes: 480, endMinutes: 660 },
  { blockIndex: 2, label: 'Impulso 2/4', startTime: '11:00', endTime: '14:00', startMinutes: 660, endMinutes: 840 },
  { blockIndex: 3, label: 'Impulso 3/4', startTime: '14:00', endTime: '17:00', startMinutes: 840, endMinutes: 1020 },
  { blockIndex: 4, label: 'Impulso 4/4', startTime: '17:00', endTime: '20:00', startMinutes: 1020, endMinutes: 1200 }
] as const;

type BlockDefinition = (typeof IMPULSE_BLOCKS)[number];
type ImpulseBlockStatus = 'ACTIVE' | 'COMPLETED' | 'MISSED';
type ImpulseActionStatus = 'AVAILABLE' | 'COMPLETED';

type RawImpulseBlock = {
  id: string;
  userId: string;
  userProgramId: string;
  programId: string;
  localDate: string;
  blockIndex: number;
  startTime: string;
  endTime: string;
  status: ImpulseBlockStatus;
  xpEarned: number;
  completedCount: number;
};

type RawImpulseAction = {
  id: string;
  impulseBlockId: string;
  taskId: string;
  taskText: string;
  category: string;
  antiSpamTag: string;
  status: ImpulseActionStatus;
  xpEarned: number;
};

type HydratedImpulseBlock = RawImpulseBlock & {
  actions: RawImpulseAction[];
};

@Injectable()
export class ImpulseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programSyncService: ProgramSyncService
  ) {}

  async getToday(userId: string, query: GetImpulseTodayQueryDto) {
    const context = await this.getActiveContext(userId);
    if (!context) {
      return {
        enabled: false,
        status: 'MISSION_NOT_COMPLETED',
        message: 'Complete today\'s mission first'
      };
    }

    const currentExecution = await this.prisma.missionExecution.findUnique({
      where: {
        userProgramId_programDay: {
          userProgramId: context.userProgram.id,
          programDay: context.userProgram.currentProgramDay
        }
      }
    });

    if (currentExecution?.status !== MissionStatus.COMPLETED) {
      return {
        enabled: false,
        status: 'MISSION_NOT_COMPLETED',
        message: 'Complete today\'s mission first'
      };
    }

    const minutes = this.parseTimeToMinutes(query.currentTime);
    const currentBlock = this.getCurrentBlock(minutes);
    const nextFutureBlock = this.getNextFutureBlock(minutes);

    await this.markMissedBlocks(context.userProgram.id, userId, query.localDate, minutes);

    const dayBlocks = await this.getHydratedBlocks(userId, context.userProgram.id, query.localDate);
    const daily = this.buildDailySummary(dayBlocks);
    const allBlocksCompleted = dayBlocks.filter((block) => block.status === 'COMPLETED').length >= 4;

    if (allBlocksCompleted || (!currentBlock && !nextFutureBlock && minutes >= IMPULSE_BLOCKS[3].endMinutes)) {
      return {
        enabled: true,
        localDate: query.localDate,
        status: 'ALL_DONE',
        currentBlock: null,
        daily,
        nextBlock: null,
        serverMessage: null
      };
    }

    if (!currentBlock) {
      return {
        enabled: true,
        localDate: query.localDate,
        status: 'BETWEEN_BLOCKS',
        currentBlock: null,
        daily,
        nextBlock: nextFutureBlock ? this.toNextBlock(nextFutureBlock) : null,
        serverMessage: null
      };
    }

    let block = dayBlocks.find((item) => item.blockIndex === currentBlock.blockIndex) ?? null;
    if (!block) {
      block = await this.createBlockForCurrentWindow(
        userId,
        context.userProgram.id,
        context.userProgram.programId,
        query.localDate,
        currentBlock
      );
    }

    const mergedBlocks = [...dayBlocks.filter((item) => item.id !== block.id), block];
    const currentBlockResponse = this.toCurrentBlockResponse(block, currentBlock);

    if (block.status === 'COMPLETED') {
      if (nextFutureBlock) {
        return {
          enabled: true,
          localDate: query.localDate,
          status: 'BLOCK_COMPLETED',
          currentBlock: currentBlockResponse,
          daily: this.buildDailySummary(mergedBlocks),
          nextBlock: this.toNextBlock(nextFutureBlock),
          serverMessage: null
        };
      }

      return {
        enabled: true,
        localDate: query.localDate,
        status: 'ALL_DONE',
        currentBlock: null,
        daily: this.buildDailySummary(mergedBlocks),
        nextBlock: null,
        serverMessage: null
      };
    }

    return {
      enabled: true,
      localDate: query.localDate,
      status: 'ACTIVE_BLOCK',
      currentBlock: currentBlockResponse,
      daily: this.buildDailySummary(mergedBlocks),
      nextBlock: nextFutureBlock ? this.toNextBlock(nextFutureBlock) : null,
      serverMessage: null
    };
  }

  async completeAction(userId: string, actionId: string, dto: CompleteImpulseActionDto) {
    const minutes = this.parseTimeToMinutes(dto.currentTime);

    await this.prisma.$transaction(async (tx) => {
      const [action] = await tx.$queryRaw<
        Array<
          RawImpulseAction & {
            blockUserId: string;
            blockLocalDate: string;
            blockIndex: number;
            blockStatus: ImpulseBlockStatus;
            blockCompletedCount: number;
            blockXpEarned: number;
          }
        >
      >`
        SELECT
          ia."id",
          ia."impulseBlockId",
          ia."taskId",
          ia."taskText",
          ia."category",
          ia."antiSpamTag",
          ia."status",
          ia."xpEarned",
          ib."userId" as "blockUserId",
          ib."localDate" as "blockLocalDate",
          ib."blockIndex",
          ib."status" as "blockStatus",
          ib."completedCount" as "blockCompletedCount",
          ib."xpEarned" as "blockXpEarned"
        FROM "ImpulseAction" ia
        INNER JOIN "ImpulseBlock" ib ON ib."id" = ia."impulseBlockId"
        WHERE ia."id" = ${actionId}::uuid
        LIMIT 1
      `;

      if (!action || action.blockUserId !== userId) {
        throw new NotFoundException('Impulse action not found');
      }

      if (action.blockLocalDate !== dto.localDate) {
        throw new ConflictException('Impulse block does not match local date');
      }

      const blockDefinition = IMPULSE_BLOCKS.find((block) => block.blockIndex === action.blockIndex);
      if (!blockDefinition || !this.isTimeInsideBlock(minutes, blockDefinition)) {
        throw new ConflictException('Impulse block is not active');
      }

      if (action.blockStatus !== 'ACTIVE') {
        throw new ConflictException('Impulse block is closed');
      }

      if (action.status !== 'AVAILABLE') {
        throw new ConflictException('Impulse action already completed');
      }

      if (action.blockCompletedCount >= 5 || action.blockXpEarned >= 12) {
        throw new ConflictException('Impulse block is already complete');
      }

      const nextOrder = action.blockCompletedCount + 1;
      const xp = this.xpForOrder(nextOrder);
      const nextCompletedCount = action.blockCompletedCount + 1;
      const nextBlockXp = action.blockXpEarned + xp;
      const nextStatus: ImpulseBlockStatus =
        nextCompletedCount >= 5 || nextBlockXp >= 12 ? 'COMPLETED' : 'ACTIVE';

      await tx.$executeRaw`
        UPDATE "ImpulseAction"
        SET
          "status" = ${'COMPLETED'}::"ImpulseActionStatus",
          "xpEarned" = ${xp},
          "completedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${action.id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE "ImpulseBlock"
        SET
          "completedCount" = ${nextCompletedCount},
          "xpEarned" = ${nextBlockXp},
          "status" = ${nextStatus}::"ImpulseBlockStatus",
          "updatedAt" = NOW()
        WHERE "id" = ${action.impulseBlockId}::uuid
      `;
    });

    return this.getToday(userId, dto);
  }

  private async getHydratedBlocks(userId: string, userProgramId: string, localDate: string): Promise<HydratedImpulseBlock[]> {
    const blocks = await this.prisma.$queryRaw<RawImpulseBlock[]>`
      SELECT
        "id",
        "userId",
        "userProgramId",
        "programId",
        "localDate",
        "blockIndex",
        "startTime",
        "endTime",
        "status",
        "xpEarned",
        "completedCount"
      FROM "ImpulseBlock"
      WHERE "userId" = ${userId}::uuid
        AND "userProgramId" = ${userProgramId}::uuid
        AND "localDate" = ${localDate}
      ORDER BY "blockIndex" ASC
    `;

    if (!blocks.length) {
      return [];
    }

    const actions = await this.prisma.$queryRaw<RawImpulseAction[]>`
      SELECT
        "id",
        "impulseBlockId",
        "taskId",
        "taskText",
        "category",
        "antiSpamTag",
        "status",
        "xpEarned"
      FROM "ImpulseAction"
      WHERE "impulseBlockId" IN (${Prisma.join(blocks.map((block) => Prisma.sql`${block.id}::uuid`))})
      ORDER BY "createdAt" ASC
    `;

    return blocks.map((block) => ({
      ...block,
      actions: actions.filter((action) => action.impulseBlockId === block.id)
    }));
  }

  private async createBlockForCurrentWindow(
    userId: string,
    userProgramId: string,
    programId: string,
    localDate: string,
    blockDefinition: BlockDefinition
  ): Promise<HydratedImpulseBlock> {
    const selection = await this.buildBlockSelection(userId, userProgramId, localDate);

    return this.prisma.$transaction(async (tx) => {
      const [block] = await tx.$queryRaw<RawImpulseBlock[]>`
        INSERT INTO "ImpulseBlock" (
          "userId",
          "userProgramId",
          "programId",
          "localDate",
          "blockIndex",
          "startTime",
          "endTime",
          "status",
          "xpEarned",
          "completedCount"
        )
        VALUES (
          ${userId}::uuid,
          ${userProgramId}::uuid,
          ${programId}::uuid,
          ${localDate},
          ${blockDefinition.blockIndex},
          ${blockDefinition.startTime},
          ${blockDefinition.endTime},
          ${'ACTIVE'}::"ImpulseBlockStatus",
          0,
          0
        )
        RETURNING
          "id",
          "userId",
          "userProgramId",
          "programId",
          "localDate",
          "blockIndex",
          "startTime",
          "endTime",
          "status",
          "xpEarned",
          "completedCount"
      `;

      for (const task of selection) {
        await tx.$executeRaw`
          INSERT INTO "ImpulseAction" (
            "impulseBlockId",
            "taskId",
            "taskText",
            "category",
            "antiSpamTag",
            "status",
            "xpEarned"
          )
          VALUES (
            ${block.id}::uuid,
            ${task.id},
            ${task.text},
            ${task.category},
            ${task.antiSpamTag},
            ${'AVAILABLE'}::"ImpulseActionStatus",
            0
          )
        `;
      }

      const actions = await tx.$queryRaw<RawImpulseAction[]>`
        SELECT
          "id",
          "impulseBlockId",
          "taskId",
          "taskText",
          "category",
          "antiSpamTag",
          "status",
          "xpEarned"
        FROM "ImpulseAction"
        WHERE "impulseBlockId" = ${block.id}::uuid
        ORDER BY "createdAt" ASC
      `;

      return { ...block, actions };
    });
  }

  private async buildBlockSelection(userId: string, userProgramId: string, localDate: string) {
    const previousCompletedActions = await this.prisma.$queryRaw<Array<{ taskId: string; antiSpamTag: string }>>`
      SELECT ia."taskId", ia."antiSpamTag"
      FROM "ImpulseAction" ia
      INNER JOIN "ImpulseBlock" ib ON ib."id" = ia."impulseBlockId"
      WHERE ib."userId" = ${userId}::uuid
        AND ib."userProgramId" = ${userProgramId}::uuid
        AND ib."localDate" = ${localDate}
        AND ia."status" = ${'COMPLETED'}::"ImpulseActionStatus"
    `;

    const completedTaskIds = new Set<string>(previousCompletedActions.map((action) => action.taskId));
    const usedTodayTags = new Set<string>(previousCompletedActions.map((action) => action.antiSpamTag));
    const selectedIds = new Set<string>();
    const selectedTags = new Set<string>();
    const chosen: ImpulseTaskDefinition[] = [];

    for (const category of ['fisico', 'orden', 'mental'] as const) {
      const task =
        this.pickWeightedTask({ category, selectedIds, selectedTags, completedTaskIds, usedTodayTags, avoidTodayTags: true }) ??
        this.pickWeightedTask({ category, selectedIds, selectedTags, completedTaskIds, usedTodayTags, avoidTodayTags: false });

      if (!task) {
        throw new ConflictException('Unable to generate impulse block');
      }

      chosen.push(task);
      selectedIds.add(task.id);
      selectedTags.add(task.antiSpamTag);
    }

    while (chosen.length < 5) {
      const task =
        this.pickWeightedTask({ selectedIds, selectedTags, completedTaskIds, usedTodayTags, avoidTodayTags: true }) ??
        this.pickWeightedTask({ selectedIds, selectedTags, completedTaskIds, usedTodayTags, avoidTodayTags: false });

      if (!task) {
        throw new ConflictException('Unable to generate impulse block');
      }

      chosen.push(task);
      selectedIds.add(task.id);
      selectedTags.add(task.antiSpamTag);
    }

    this.enforceEffortQuota(chosen, selectedIds, selectedTags, completedTaskIds, usedTodayTags);
    return chosen;
  }

  private enforceEffortQuota(
    chosen: ImpulseTaskDefinition[],
    selectedIds: Set<string>,
    selectedTags: Set<string>,
    completedTaskIds: Set<string>,
    usedTodayTags: Set<string>
  ) {
    let highEffortCount = chosen.filter((task) => task.effort >= 2).length;

    while (highEffortCount < 2) {
      const replacement =
        this.pickWeightedTask({
          selectedIds,
          selectedTags,
          completedTaskIds,
          usedTodayTags,
          avoidTodayTags: true,
          minimumEffort: 2
        }) ??
        this.pickWeightedTask({
          selectedIds,
          selectedTags,
          completedTaskIds,
          usedTodayTags,
          avoidTodayTags: false,
          minimumEffort: 2
        });

      if (!replacement) {
        return;
      }

      const replaceIndex = chosen.findIndex((task) => task.effort < 2);
      if (replaceIndex === -1) {
        return;
      }

      selectedIds.delete(chosen[replaceIndex].id);
      selectedTags.delete(chosen[replaceIndex].antiSpamTag);
      chosen[replaceIndex] = replacement;
      selectedIds.add(replacement.id);
      selectedTags.add(replacement.antiSpamTag);
      highEffortCount = chosen.filter((task) => task.effort >= 2).length;
    }
  }

  private pickWeightedTask(filters: {
    category?: ImpulseTaskDefinition['category'];
    selectedIds: Set<string>;
    selectedTags: Set<string>;
    completedTaskIds: Set<string>;
    usedTodayTags: Set<string>;
    avoidTodayTags: boolean;
    minimumEffort?: 2 | 3;
  }) {
    const candidates = IMPULSE_TASKS.filter((task) => {
      if (filters.category && task.category !== filters.category) {
        return false;
      }

      if (filters.minimumEffort && task.effort < filters.minimumEffort) {
        return false;
      }

      if (filters.selectedIds.has(task.id) || filters.selectedTags.has(task.antiSpamTag)) {
        return false;
      }

      if (filters.completedTaskIds.has(task.id)) {
        return false;
      }

      if (filters.avoidTodayTags && filters.usedTodayTags.has(task.antiSpamTag)) {
        return false;
      }

      return true;
    });

    if (!candidates.length) {
      return null;
    }

    const totalWeight = candidates.reduce((sum, task) => sum + task.noveltyWeight, 0);
    let cursor = Math.random() * totalWeight;

    for (const task of candidates) {
      cursor -= task.noveltyWeight;
      if (cursor <= 0) {
        return task;
      }
    }

    return candidates[candidates.length - 1] ?? null;
  }

  private async markMissedBlocks(userProgramId: string, userId: string, localDate: string, minutes: number) {
    const elapsedIndices = IMPULSE_BLOCKS.filter((block) => minutes >= block.endMinutes).map((block) => block.blockIndex);
    if (!elapsedIndices.length) {
      return;
    }

    for (const blockIndex of elapsedIndices) {
      await this.prisma.$executeRaw`
        UPDATE "ImpulseBlock"
        SET
          "status" = ${'MISSED'}::"ImpulseBlockStatus",
          "updatedAt" = NOW()
        WHERE "userId" = ${userId}::uuid
          AND "userProgramId" = ${userProgramId}::uuid
          AND "localDate" = ${localDate}
          AND "blockIndex" = ${blockIndex}
          AND "status" = ${'ACTIVE'}::"ImpulseBlockStatus"
      `;
    }
  }

  private buildDailySummary(blocks: HydratedImpulseBlock[]) {
    return {
      xpEarned: blocks.reduce((sum, block) => sum + block.xpEarned, 0),
      xpMax: 48,
      blocksCompleted: blocks.filter((block) => block.status === 'COMPLETED').length,
      blocksAvailable: 4,
      actionsCompleted: blocks.reduce((sum, block) => sum + block.completedCount, 0)
    };
  }

  private toCurrentBlockResponse(block: HydratedImpulseBlock, blockDefinition: BlockDefinition) {
    return {
      id: block.id,
      blockIndex: block.blockIndex,
      label: blockDefinition.label,
      startTime: blockDefinition.startTime,
      endTime: blockDefinition.endTime,
      status: block.status,
      xpEarned: block.xpEarned,
      xpMax: 12,
      completedCount: block.completedCount,
      tasksMax: 5,
      actions: block.actions.map((action) => ({
        id: action.id,
        taskId: action.taskId,
        taskText: action.taskText,
        category: action.category,
        status: action.status,
        xpEarned: action.xpEarned
      }))
    };
  }

  private toNextBlock(block: BlockDefinition) {
    return {
      blockIndex: block.blockIndex,
      startTime: block.startTime,
      endTime: block.endTime
    };
  }

  private async getActiveContext(userId: string) {
    const synced = await this.programSyncService.syncActiveProgram(userId);
    if (!synced.userProgram || synced.userProgram.status !== ProgramStatus.ACTIVE) {
      return null;
    }

    const activeUserProgram = await this.prisma.userProgram.findUnique({
      where: { id: synced.userProgram.id },
      include: {
        program: {
          select: { id: true, slug: true }
        }
      }
    });

    if (!activeUserProgram || activeUserProgram.program.slug !== RESET_PROGRAM_SLUG) {
      return null;
    }

    return { userProgram: activeUserProgram };
  }

  private parseTimeToMinutes(currentTime: string) {
    const [hours, minutes] = currentTime.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  }

  private getCurrentBlock(minutes: number): BlockDefinition | null {
    return IMPULSE_BLOCKS.find((block) => minutes >= block.startMinutes && minutes < block.endMinutes) ?? null;
  }

  private getNextFutureBlock(minutes: number): BlockDefinition | null {
    return IMPULSE_BLOCKS.find((block) => block.startMinutes > minutes) ?? null;
  }

  private isTimeInsideBlock(minutes: number, block: BlockDefinition) {
    return minutes >= block.startMinutes && minutes < block.endMinutes;
  }

  private xpForOrder(order: number) {
    switch (order) {
      case 1:
        return 4;
      case 2:
        return 3;
      case 3:
        return 2;
      case 4:
        return 2;
      case 5:
        return 1;
      default:
        return 0;
    }
  }
}
