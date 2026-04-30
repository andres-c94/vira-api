import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateLeaderboardProfileDto {
  @IsBoolean()
  globalLeaderboardOptIn!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[\p{L}\p{N}_ -]+$/u, {
    message: 'displayName can only contain letters, numbers, spaces, hyphen and underscore'
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  displayName?: string | null;
}
