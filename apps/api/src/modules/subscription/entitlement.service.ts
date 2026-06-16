import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { Entitlement } from '@dating-app/types';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class EntitlementService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getEntitlement(userId: string): Promise<Entitlement> {
    const cacheKey = `entitlement:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const plan = subscription?.status === 'active' ? subscription.plan : 'free';
    const entitlement = this.calculateEntitlement(plan);

    await this.redis.set(cacheKey, JSON.stringify(entitlement), 'EX', CACHE_TTL);

    return entitlement;
  }

  calculateEntitlement(plan: string): Entitlement {
    switch (plan) {
      case 'premium':
        return {
          plan: 'premium',
          fullFeed: true,
          unlimitedLikes: true,
          rewind: true,
          advancedPrefs: true,
          likesYou: true,
          incognito: true,
          travel: true,
          priorityLikes: true,
          dailyLikeQuota: null,
        };
      case 'plus':
        return {
          plan: 'plus',
          fullFeed: true,
          unlimitedLikes: true,
          rewind: true,
          advancedPrefs: true,
          likesYou: false,
          incognito: false,
          travel: false,
          priorityLikes: false,
          dailyLikeQuota: null,
        };
      default:
        return {
          plan: 'free',
          fullFeed: false,
          unlimitedLikes: false,
          rewind: false,
          advancedPrefs: false,
          likesYou: false,
          incognito: false,
          travel: false,
          priorityLikes: false,
          dailyLikeQuota: 5,
        };
    }
  }

  async invalidateCache(userId: string) {
    await this.redis.del(`entitlement:${userId}`);
  }
}
