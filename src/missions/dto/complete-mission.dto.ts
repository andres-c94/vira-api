import { Mood } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CompleteMissionDto {
  @IsInt()
  @Min(0)
  durationMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  difficultyRating!: number;

  @IsInt()
  @Min(0)
  socialMediaMinutes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reflection?: string;

  @IsOptional()
  @IsEnum(Mood)
  mood?: Mood;
}
