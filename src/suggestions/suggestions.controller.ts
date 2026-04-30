import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { SuggestionsService } from './suggestions.service';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  createSuggestion(@Body() dto: CreateSuggestionDto, @CurrentUser() user: JwtUser | null) {
    return this.suggestionsService.createSuggestion(dto, user ?? null);
  }
}
