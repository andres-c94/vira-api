import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum SuggestionTypeValue {
  IDEA = 'IDEA',
  PROBLEM = 'PROBLEM',
  IMPROVEMENT = 'IMPROVEMENT',
  OTHER = 'OTHER'
}

export class CreateSuggestionDto {
  @IsEnum(SuggestionTypeValue)
  type!: SuggestionTypeValue;

  @IsString()
  @MinLength(10)
  @MaxLength(800)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message!: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  email?: string | null;
}
