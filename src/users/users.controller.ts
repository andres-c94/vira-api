import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/timezone')
  updateTimezone(@CurrentUser() user: JwtUser, @Body() dto: UpdateTimezoneDto) {
    return this.usersService.updateTimezone(user.sub, dto);
  }

  @Patch('me/reminders')
  updateReminderSettings(@CurrentUser() user: JwtUser, @Body() dto: UpdateReminderSettingsDto) {
    return this.usersService.updateReminderSettings(user.sub, dto);
  }
}
