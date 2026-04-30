import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgramSyncService } from '../program-sync/program-sync.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, ProgramSyncService]
})
export class LeaderboardModule {}
