import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { SubscriptionService } from './subscription.service';
import type { EntitlementService } from './entitlement.service';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private entitlementService: EntitlementService,
  ) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verify(@Body() body: { transactionId: string }, @Req() req: Request) {
    return this.subscriptionService.verifyAndUpsert(req.user!.id, body.transactionId);
  }

  @Get('entitlements')
  @UseGuards(JwtAuthGuard)
  async getEntitlements(@Req() req: Request) {
    return this.entitlementService.getEntitlement(req.user!.id);
  }

  @Post('webhook')
  async webhook(@Body() body: { signedPayload: string }) {
    await this.subscriptionService.processWebhook(body.signedPayload);
    return { success: true };
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  async restore(@Body() body: { transactionIds: string[] }, @Req() req: Request) {
    return this.subscriptionService.restore(req.user!.id, body.transactionIds);
  }
}
