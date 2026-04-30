import { Injectable, NotFoundException } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProgramSyncService } from '../program-sync/program-sync.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programSyncService: ProgramSyncService
  ) {}

  async getSummary(userId: string) {
    const synced = await this.programSyncService.syncActiveProgram(userId);
    if (!synced.userProgram) {
      throw new NotFoundException('No active program');
    }

    if (synced.userProgram.status === ProgramStatus.COMPLETED) {
      throw new NotFoundException('No active program');
    }

    const userProgram = await this.prisma.userProgram.findUniqueOrThrow({
      where: { id: synced.userProgram.id },
      include: {
        program: true,
        missionExecutions: {
          select: { status: true, socialMediaMinutes: true }
        }
      }
    });

    if (userProgram.status !== ProgramStatus.ACTIVE) {
      throw new NotFoundException('No active program');
    }

    return this.programSyncService.getProgressSnapshot(userProgram);
  }
}
