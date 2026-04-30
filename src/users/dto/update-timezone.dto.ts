import { IsString } from 'class-validator';

export class UpdateTimezoneDto {
  @IsString()
  timezone!: string;
}
