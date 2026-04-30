import { IsString, Matches } from 'class-validator';

export class CompleteImpulseActionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'localDate must use YYYY-MM-DD format'
  })
  localDate!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'currentTime must use HH:mm format'
  })
  currentTime!: string;
}
