import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

@Module({
  imports: [AuthModule],
  providers: [ReportService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}
