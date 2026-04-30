import { IsUUID } from 'class-validator';

export class StartProgramDto {
  @IsUUID()
  programId!: string;
}
