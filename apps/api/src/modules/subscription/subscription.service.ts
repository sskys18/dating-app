import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppStoreService } from './app-store.service';
import { EntitlementService } from './entitlement.service';
import { NotificationTypeV2 } from '@apple/app-store-server-library';
import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  plus: 1,
  premium: 2,
};

function planFromProductId(productId: string | undefined): string {
  if (!productId) return 'free';
  if (productId.includes('premium')) return 'premium';
  if (productId.includes('plus')) return 'plus';
  return 'free';
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private prisma: PrismaService,
    private appStoreService: AppStoreService,
    private entitlementService: EntitlementService,
  ) {}

  async verifyAndUpsert(userId: string, transactionId: string) {
    const txn = await this.appStoreService.verifyTransaction(transactionId);
    await this.upsertFromTransaction(userId, txn);
    await this.entitlementService.invalidateCache(userId);
    return this.entitlementService.getEntitlement(userId);
  }

  async processWebhook(signedPayload: string) {
    const notification = await this.appStoreService.verifyNotification(signedPayload);
    const type = notification.notificationType as NotificationTypeV2;
    const data = notification.data;

    if (!data?.signedTransactionInfo) {
      this.logger.warn(`Webhook ${type} missing signedTransactionInfo`);
      return;
    }

    // We need to find the user from the originalTransactionId
    // The signedTransactionInfo is a JWS — we need to decode it via verifier
    // But for webhook processing, we can parse the transaction data
    // from the notification's data field
    const txnInfo = data.signedTransactionInfo;
    // Decode by verifying
    let txn: JWSTransactionDecodedPayload;
    try {
      // Re-use the verifier from AppStoreService through a direct decode
      // Since we already verified the notification, we trust the embedded transaction
      const decoded = JSON.parse(
        Buffer.from(txnInfo.split('.')[1], 'base64url').toString(),
      );
      txn = decoded as JWSTransactionDecodedPayload;
    } catch {
      this.logger.error('Failed to decode transaction from webhook');
      return;
    }

    const originalTransactionId = txn.originalTransactionId;
    if (!originalTransactionId) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { originalTransactionId },
    });

    if (!subscription && type !== NotificationTypeV2.SUBSCRIBED) {
      this.logger.warn(`No subscription found for originalTransactionId ${originalTransactionId}`);
      return;
    }

    const userId = subscription?.userId;

    switch (type) {
      case NotificationTypeV2.SUBSCRIBED: {
        // For new subscriptions, we may not have an existing record
        // This is handled when the client calls /verify
        if (subscription) {
          await this.upsertFromTransaction(subscription.userId, txn);
          await this.entitlementService.invalidateCache(subscription.userId);
        }
        break;
      }
      case NotificationTypeV2.DID_RENEW: {
        if (userId) {
          await this.prisma.subscription.update({
            where: { userId },
            data: {
              expiresAt: txn.expiresDate ? new Date(txn.expiresDate) : undefined,
              status: 'active',
            },
          });
          await this.entitlementService.invalidateCache(userId);
        }
        break;
      }
      case NotificationTypeV2.EXPIRED:
      case NotificationTypeV2.GRACE_PERIOD_EXPIRED: {
        if (userId) {
          await this.prisma.subscription.update({
            where: { userId },
            data: { status: 'expired' },
          });
          await this.entitlementService.invalidateCache(userId);
        }
        break;
      }
      case NotificationTypeV2.REFUND: {
        if (userId) {
          await this.prisma.subscription.update({
            where: { userId },
            data: { status: 'cancelled' },
          });
          await this.entitlementService.invalidateCache(userId);
        }
        break;
      }
      case NotificationTypeV2.DID_FAIL_TO_RENEW: {
        if (userId) {
          await this.prisma.subscription.update({
            where: { userId },
            data: { status: 'billing_retry' },
          });
          await this.entitlementService.invalidateCache(userId);
        }
        break;
      }
      case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: {
        if (userId) {
          const autoRenew = txn.expiresDate ? txn.expiresDate > Date.now() : false;
          await this.prisma.subscription.update({
            where: { userId },
            data: { autoRenew },
          });
          await this.entitlementService.invalidateCache(userId);
        }
        break;
      }
      default:
        this.logger.log(`Unhandled notification type: ${type}`);
    }
  }

  async restore(userId: string, transactionIds: string[]) {
    let highestPlan = 'free';

    for (const transactionId of transactionIds) {
      try {
        const txn = await this.appStoreService.verifyTransaction(transactionId);
        const plan = planFromProductId(txn.productId);
        if ((PLAN_TIERS[plan] ?? 0) > (PLAN_TIERS[highestPlan] ?? 0)) {
          highestPlan = plan;
          await this.upsertFromTransaction(userId, txn);
        }
      } catch (e) {
        this.logger.warn(`Failed to verify transaction ${transactionId}: ${e}`);
      }
    }

    await this.entitlementService.invalidateCache(userId);
    return this.entitlementService.getEntitlement(userId);
  }

  private async upsertFromTransaction(userId: string, txn: JWSTransactionDecodedPayload) {
    const plan = planFromProductId(txn.productId);

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        sku: txn.productId ?? null,
        originalTransactionId: txn.originalTransactionId ?? null,
        expiresAt: txn.expiresDate ? new Date(txn.expiresDate) : null,
        status: 'active',
        autoRenew: true,
      },
      update: {
        plan,
        sku: txn.productId ?? undefined,
        originalTransactionId: txn.originalTransactionId ?? undefined,
        expiresAt: txn.expiresDate ? new Date(txn.expiresDate) : undefined,
        status: 'active',
        autoRenew: true,
      },
    });
  }
}
