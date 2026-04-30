import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateLeaderboardProfileDto } from './dto/update-leaderboard-profile.dto';
import { LeaderboardService } from './leaderboard.service';

@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: JwtUser) {
    return this.leaderboardService.getMyProfile(user.sub);
  }

  @Patch('me')
  updateMyProfile(@CurrentUser() user: JwtUser, @Body() dto: UpdateLeaderboardProfileDto) {
    return this.leaderboardService.updateMyProfile(user.sub, dto);
  }

  @Get('global')
  getGlobal(@CurrentUser() user: JwtUser) {
    return this.leaderboardService.getGlobalLeaderboard(user.sub);
  }
}
