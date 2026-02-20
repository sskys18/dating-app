import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockService } from './block.service';
import { BlockController } from './block.controller';

@Module({
  imports: [AuthModule],
  providers: [BlockService],
  controllers: [BlockController],
  exports: [BlockService],
})
export class BlockModule {}
