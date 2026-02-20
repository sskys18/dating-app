import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { HandoffService } from './handoff.service';
import { HandoffController } from './handoff.controller';

@Module({
  imports: [AuthModule],
  providers: [HandoffService],
  controllers: [HandoffController],
})
export class HandoffModule {}
