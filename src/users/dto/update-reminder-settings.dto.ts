import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateReminderSettingsDto {
  @IsBoolean()
  reminderEnabled!: boolean;

  @IsOptional()
  @IsString()
  reminderTime!: string | null;
}
