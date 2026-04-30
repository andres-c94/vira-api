import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/current-user.decorator';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSuggestion(dto: CreateSuggestionDto, user: JwtUser | null) {
    const userIdValue = user?.sub ? Prisma.sql`${user.sub}::uuid` : Prisma.sql`NULL`;

    await this.prisma.$executeRaw`
      INSERT INTO "UserSuggestion" (
        "userId",
        "type",
        "message",
        "email",
        "status",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${userIdValue},
        ${dto.type}::"SuggestionType",
        ${dto.message},
        ${dto.email ?? null},
        ${'NEW'}::"SuggestionStatus",
        NOW(),
        NOW()
      )
    `;

    return {
      message: 'Suggestion received'
    };
  }
}
