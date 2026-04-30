import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartProgramDto } from './dto/start-program.dto';
import { UserProgramsService } from './user-programs.service';

@UseGuards(JwtAuthGuard)
@Controller('user-programs')
export class UserProgramsController {
  constructor(private readonly userProgramsService: UserProgramsService) {}

  @Post('start')
  startProgram(@CurrentUser() user: JwtUser, @Body() dto: StartProgramDto) {
    return this.userProgramsService.startProgram(user.sub, dto);
  }

  @Get('active')
  getActiveProgram(@CurrentUser() user: JwtUser) {
    return this.userProgramsService.getActiveProgram(user.sub);
  }
}
