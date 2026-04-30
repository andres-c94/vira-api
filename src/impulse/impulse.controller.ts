import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompleteImpulseActionDto } from './dto/complete-impulse-action.dto';
import { GetImpulseTodayQueryDto } from './dto/get-impulse-today-query.dto';
import { ImpulseService } from './impulse.service';

@UseGuards(JwtAuthGuard)
@Controller('impulse')
export class ImpulseController {
  constructor(private readonly impulseService: ImpulseService) {}

  @Get('today')
  getToday(@CurrentUser() user: JwtUser, @Query() query: GetImpulseTodayQueryDto) {
    return this.impulseService.getToday(user.sub, query);
  }

  @Patch('actions/:actionId/complete')
  completeAction(
    @CurrentUser() user: JwtUser,
    @Param('actionId') actionId: string,
    @Body() dto: CompleteImpulseActionDto
  ) {
    return this.impulseService.completeAction(user.sub, actionId, dto);
  }
}
