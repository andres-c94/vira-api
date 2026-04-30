import { FailureReason, Mood } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class FailMissionDto {
  @IsEnum(FailureReason)
  reason!: FailureReason;

  @IsOptional()
  @IsEnum(Mood)
  mood?: Mood;
}
