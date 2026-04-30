import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnalyticsEventType, Prisma, ProgramStatus } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { DEFAULT_TIMEZONE } from '../domain.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { StartProgramDto } from './dto/start-program.dto';

@Injectable()
export class UserProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly programSyncService: ProgramSyncService
  ) {}

  async startProgram(userId: string, dto: StartProgramDto) {
    await this.programSyncService.syncActiveProgram(userId);

    const existingActive = await this.prisma.userProgram.findFirst({
      where: {
        userId,
        programId: dto.programId,
        status: ProgramStatus.ACTIVE
      }
    });

    if (existingActive) {
      throw new ConflictException('User already has an active program');
    }

    const [user, programRows] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.$queryRaw<Array<{ id: string; accessType: 'FREE' | 'LOCKED_BETA' | 'PAID' }>>(Prisma.sql`
        SELECT "id", "accessType"
        FROM "Program"
        WHERE "id" = ${dto.programId}::uuid
        LIMIT 1
      `)
    ]);

    const program = programRows[0];

    if (!program) {
      throw new ForbiddenException('Program is not available');
    }

    if (program.accessType === 'LOCKED_BETA') {
      throw new ForbiddenException('Program is not available yet');
    }

    if (program.accessType === 'PAID') {
      throw new ForbiddenException('Paid programs are not enabled yet');
    }

    const userProgram = await this.prisma.userProgram.create({
      data: {
        userId,
        programId: program.id,
        startedAt: new Date(),
        lockedTimezone: user.timezone ?? DEFAULT_TIMEZONE
      },
      include: {
        program: true
      }
    });

    await this.analyticsService.trackEvent({
      userId,
      programId: program.id,
      userProgramId: userProgram.id,
      eventType: AnalyticsEventType.PROGRAM_STARTED,
      payload: {
        timestamp: userProgram.startedAt.toISOString()
      }
    });

    return userProgram;
  }

  async getActiveProgram(userId: string) {
    const result = await this.programSyncService.syncActiveProgram(userId);
    if (!result.userProgram) {
      return { program: null, message: 'No active program' };
    }

    if (result.userProgram.status === ProgramStatus.COMPLETED) {
      return {
        ...result.userProgram,
        message: 'Program completed'
      };
    }

    return result.userProgram;
  }
}
