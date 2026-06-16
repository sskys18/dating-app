import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { S3Service } from '../photo/s3.service';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';

@Module({
  imports: [AuthModule],
  providers: [AccountService, S3Service],
  controllers: [AccountController],
})
export class AccountModule {}
