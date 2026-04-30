import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ProgramsModule } from '../programs/programs.module';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { UserProgramsController } from './user-programs.controller';
import { UserProgramsService } from './user-programs.service';

@Module({
  imports: [ProgramsModule, AnalyticsModule],
  controllers: [UserProgramsController],
  providers: [UserProgramsService, ProgramSyncService],
  exports: [UserProgramsService, ProgramSyncService]
})
export class UserProgramsModule {}
