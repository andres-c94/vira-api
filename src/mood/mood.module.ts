import { Module } from '@nestjs/common';
import { MoodService } from './mood.service';

@Module({
  providers: [MoodService],
  exports: [MoodService]
})
export class MoodModule {}
