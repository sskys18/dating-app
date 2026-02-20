import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppStoreService } from './app-store.service';
import { EntitlementService } from './entitlement.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [AuthModule],
  providers: [AppStoreService, EntitlementService, SubscriptionService],
  controllers: [SubscriptionController],
  exports: [EntitlementService],
})
export class SubscriptionModule {}
