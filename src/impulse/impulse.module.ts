import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserProgramsModule } from '../user-programs/user-programs.module';
import { ImpulseController } from './impulse.controller';
import { ImpulseService } from './impulse.service';

@Module({
  imports: [PrismaModule, UserProgramsModule],
  controllers: [ImpulseController],
  providers: [ImpulseService],
  exports: [ImpulseService]
})
export class ImpulseModule {}
