import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProgramsModule } from './programs/programs.module';
import { UserProgramsModule } from './user-programs/user-programs.module';
import { MissionsModule } from './missions/missions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MoodModule } from './mood/mood.module';
import { ProgressModule } from './progress/progress.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { ImpulseModule } from './impulse/impulse.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProgramsModule,
    UserProgramsModule,
    MissionsModule,
    DashboardModule,
    MoodModule,
    ProgressModule,
    AnalyticsModule,
    LeaderboardModule,
    ImpulseModule,
    SuggestionsModule
  ]
})
export class AppModule {}
