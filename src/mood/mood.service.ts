import { ConflictException, Injectable } from '@nestjs/common';
import { Mood, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MoodService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMood(tx: Prisma.TransactionClient, input: {
    userProgramId: string;
    programDay: number;
    localDate: string;
    mood: Mood;
  }) {
    const existingMood = await tx.dailyMood.findUnique({
      where: {
        userProgramId_programDay: {
          userProgramId: input.userProgramId,
          programDay: input.programDay
        }
      }
    });

    if (existingMood) {
      throw new ConflictException('Mood already recorded for today');
    }

    return tx.dailyMood.create({
      data: {
        userProgramId: input.userProgramId,
        programDay: input.programDay,
        localDate: input.localDate,
        mood: input.mood,
        recordedAt: new Date()
      }
    });
  }
}
