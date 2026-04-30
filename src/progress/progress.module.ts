import { Module } from '@nestjs/common';
import { UserProgramsModule } from '../user-programs/user-programs.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [UserProgramsModule],
  controllers: [ProgressController],
  providers: [ProgressService]
})
export class ProgressModule {}
