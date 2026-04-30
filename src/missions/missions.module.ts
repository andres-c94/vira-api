import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MoodModule } from '../mood/mood.module';
import { UserProgramsModule } from '../user-programs/user-programs.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [UserProgramsModule, AnalyticsModule, MoodModule],
  controllers: [MissionsController],
  providers: [MissionsService]
})
export class MissionsModule {}
