import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { AnalyticsEventType, Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';

type ProgramAccessTypeValue = 'FREE' | 'LOCKED_BETA' | 'PAID';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService
  ) {}

  listPrograms(): Promise<Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    totalDays: number;
    accessType: ProgramAccessTypeValue;
    betaInterestCount: number;
    isActive: boolean;
  }>> {
    return this.prisma.$queryRaw`
      SELECT
        "id",
        "slug",
        "title",
        "description",
        "totalDays",
        "accessType",
        "betaInterestCount",
        "isActive"
      FROM "Program"
      WHERE "isActive" = true
        AND "accessType" IN ('FREE', 'LOCKED_BETA')
      ORDER BY "createdAt" ASC
    `;
  }

  getProgramMissions(programId: string) {
    return this.prisma.programMission.findMany({
      where: { programId },
      orderBy: { dayNumber: 'asc' }
    });
  }

  async registerInterest(userId: string, programId: string) {
    const [program] = await this.prisma.$queryRaw<Array<{
      id: string;
      title: string;
      accessType: ProgramAccessTypeValue;
    }>>(Prisma.sql`
      SELECT "id", "title", "accessType"
      FROM "Program"
      WHERE "id" = ${programId}::uuid
      LIMIT 1
    `);

    if (!program) {
      throw new ForbiddenException('Program is not available');
    }

    if (program.accessType !== 'LOCKED_BETA') {
      throw new ForbiddenException('Interest is only available for locked beta programs');
    }

    const existingInterest = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "ProgramInterest"
      WHERE "userId" = ${userId}::uuid
        AND "programId" = ${programId}::uuid
      LIMIT 1
    `);

    if (existingInterest.length > 0) {
      throw new ConflictException('Interest already registered');
    }

    const updatedProgram = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "ProgramInterest" ("id", "userId", "programId", "createdAt")
        VALUES (gen_random_uuid(), ${userId}::uuid, ${programId}::uuid, now())
      `);

      const [nextProgram] = await tx.$queryRaw<Array<{ id: string; betaInterestCount: number }>>(Prisma.sql`
        UPDATE "Program"
        SET "betaInterestCount" = "betaInterestCount" + 1,
            "updatedAt" = now()
        WHERE "id" = ${programId}::uuid
        RETURNING "id", "betaInterestCount"
      `);

      await this.analyticsService.trackEvent({
        tx,
        userId,
        programId,
        eventType: 'PROGRAM_INTEREST_REGISTERED' as AnalyticsEventType,
        payload: {
          programId: program.id,
          programTitle: program.title,
          accessType: program.accessType
        }
      });

      return nextProgram;
    });

    return {
      message: 'Interest registered',
      programId: updatedProgram?.id ?? programId,
      betaInterestCount: updatedProgram?.betaInterestCount ?? 0
    };
  }
}
