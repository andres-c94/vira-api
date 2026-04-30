import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService]
})
export class SuggestionsModule {}
