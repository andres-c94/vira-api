import { Mood } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class RecordMoodDto {
  @IsEnum(Mood)
  mood!: Mood;
}
