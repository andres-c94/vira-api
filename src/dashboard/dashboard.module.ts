import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UserProgramsModule } from '../user-programs/user-programs.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [UserProgramsModule, AnalyticsModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
