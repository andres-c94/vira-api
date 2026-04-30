import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProgramsService } from './programs.service';

@UseGuards(JwtAuthGuard)
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  listPrograms() {
    return this.programsService.listPrograms();
  }

  @Get(':id/missions')
  getProgramMissions(@Param('id') id: string) {
    return this.programsService.getProgramMissions(id);
  }

  @Post(':programId/interest')
  registerInterest(@CurrentUser() user: JwtUser, @Param('programId') programId: string) {
    return this.programsService.registerInterest(user.sub, programId);
  }
}
