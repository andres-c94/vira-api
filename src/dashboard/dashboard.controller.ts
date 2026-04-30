import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  getToday(@CurrentUser() user: JwtUser) {
    return this.dashboardService.getToday(user.sub);
  }
}
