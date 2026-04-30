import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateReminderSettingsDto } from './dto/update-reminder-settings.dto';
import { UpdateTimezoneDto } from './dto/update-timezone.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  updateTimezone(userId: string, dto: UpdateTimezoneDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { timezone: dto.timezone },
      select: {
        id: true,
        email: true,
        timezone: true,
        reminderEnabled: true,
        reminderTime: true
      }
    });
  }

  updateReminderSettings(userId: string, dto: UpdateReminderSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        reminderEnabled: dto.reminderEnabled,
        reminderTime: dto.reminderTime
      },
      select: {
        id: true,
        email: true,
        timezone: true,
        reminderEnabled: true,
        reminderTime: true
      }
    });
  }
}
