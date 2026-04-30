import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('programs/:programId/summary')
  getProgramSummary(@Param('programId') programId: string) {
    return this.analyticsService.getProgramSummary(programId);
  }

  @Get('programs/:programId/by-day')
  getProgramByDay(@Param('programId') programId: string) {
    return this.analyticsService.getProgramByDay(programId);
  }
}
