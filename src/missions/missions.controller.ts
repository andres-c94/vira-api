import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecordMoodDto } from '../mood/dto/record-mood.dto';
import { CompleteMissionDto } from './dto/complete-mission.dto';
import { FailMissionDto } from './dto/fail-mission.dto';
import { MissionsService } from './missions.service';

@UseGuards(JwtAuthGuard)
@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Post('today/complete')
  completeTodayMission(@CurrentUser() user: JwtUser, @Body() dto: CompleteMissionDto) {
    return this.missionsService.completeTodayMission(user.sub, dto);
  }

  @Post('today/fail')
  failTodayMission(@CurrentUser() user: JwtUser, @Body() dto: FailMissionDto) {
    return this.missionsService.failTodayMission(user.sub, dto);
  }

  @Post('today/mood')
  recordMood(@CurrentUser() user: JwtUser, @Body() dto: RecordMoodDto) {
    return this.missionsService.recordMood(user.sub, dto.mood);
  }
}
