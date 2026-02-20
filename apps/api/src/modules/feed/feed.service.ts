import { Injectable, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import type { EntitlementService } from '../subscription/entitlement.service';
import type { BlockService } from '../block/block.service';
import type { NotificationService } from '../notification/notification.service';
import { computeRealCompatibility } from './feed-scoring.util';
import type { FeedCard } from '@dating-app/types';

function getUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private entitlementService: EntitlementService,
    private blockService: BlockService,
    private notificationService: NotificationService,
  ) {}

  async getFeed(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<{ items: FeedCard[]; nextCursor: string | null }> {
    const entitlement = await this.entitlementService.getEntitlement(userId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        type: true,
        matchingCriteria: true,
      },
    });

    const weights = (user.matchingCriteria?.weights as Record<string, number>) ?? {};

    // Build exclusion list
    const blockedIds = await this.blockService.getBlockedIds(userId);
    const seenIds = await this.redis.smembers(`feed:seen:${userId}`);
    const actedOnUsers = await this.prisma.like.findMany({
      where: { fromUserId: userId },
      select: { toUserId: true },
    });
    const actedOnIds = actedOnUsers.map((l) => l.toUserId);

    const exclusions = [
      userId,
      ...blockedIds,
      ...seenIds,
      ...actedOnIds,
    ];
    const uniqueExclusions = [...new Set(exclusions)];

    // Query candidates
    const candidates = await this.prisma.user.findMany({
      where: {
        id: { notIn: uniqueExclusions },
        status: 'active',
        profileComplete: true,
      },
      include: {
        type: true,
        photos: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    // Score and sort
    const scored = candidates
      .filter((c) => c.type !== null)
      .map((c) => ({
        candidate: c,
        score: user.type
          ? computeRealCompatibility(user.type, c.type!, weights)
          : 60,
      }))
      .sort((a, b) => b.score - a.score);

    // Apply feed limit for free users
    let pool = scored;
    if (!entitlement.fullFeed) {
      pool = scored.slice(0, 3);
    }

    // Cursor pagination
    if (cursor) {
      const cursorIndex = pool.findIndex((s) => s.candidate.id === cursor);
      if (cursorIndex >= 0) {
        pool = pool.slice(cursorIndex + 1);
      }
    }

    const page = pool.slice(0, limit);
    const hasMore = pool.length > limit;
    const nextCursor = hasMore ? page[page.length - 1]?.candidate.id ?? null : null;

    // Add to seen set
    if (page.length > 0) {
      const ids = page.map((p) => p.candidate.id);
      await this.redis.sadd(`feed:seen:${userId}`, ...ids);
      await this.redis.expire(`feed:seen:${userId}`, 86400);
    }

    // Map to FeedCard
    const items: FeedCard[] = page.map((p) => ({
      userId: p.candidate.id,
      nickname: p.candidate.nickname ?? '',
      age: p.candidate.birthDate ? calculateAge(p.candidate.birthDate) : 0,
      introLine: p.candidate.introLine,
      photoUrl: p.candidate.photos[0]?.url ?? '',
      locationLabel: p.candidate.locationLabel,
      compatibilityScore: p.score,
      typeLabel: p.candidate.typeVisible ? (p.candidate.type?.label ?? null) : null,
    }));

    return { items, nextCursor };
  }

  async likeOrPass(userId: string, targetUserId: string, action: 'like' | 'pass') {
    // Check block
    const blocked = await this.blockService.isBlocked(userId, targetUserId);
    if (blocked) {
      throw new ForbiddenException('Cannot interact with this user');
    }

    if (action === 'like') {
      // Check daily quota
      const dateStr = getUtcDateStr();
      const quotaKey = `likes:daily:${userId}:${dateStr}`;
      const count = await this.redis.incr(quotaKey);
      if (count === 1) {
        // Set TTL to expire at end of UTC day
        const now = new Date();
        const endOfDay = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
        );
        const ttl = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);
        await this.redis.expire(quotaKey, ttl);
      }

      const entitlement = await this.entitlementService.getEntitlement(userId);
      if (
        entitlement.dailyLikeQuota !== null &&
        count > entitlement.dailyLikeQuota
      ) {
        // Decrement back since we already incremented
        await this.redis.decr(quotaKey);
        throw new ForbiddenException('Daily like quota exceeded');
      }
    }

    // Load user nickname for notification
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });

    // Transaction: upsert like + check for mutual match
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.like.upsert({
        where: {
          fromUserId_toUserId: { fromUserId: userId, toUserId: targetUserId },
        },
        create: { fromUserId: userId, toUserId: targetUserId, action },
        update: { action },
      });

      if (action === 'like') {
        // Check reciprocal
        const reciprocal = await tx.like.findFirst({
          where: {
            fromUserId: targetUserId,
            toUserId: userId,
            action: 'like',
          },
        });

        if (reciprocal) {
          // Mutual like — create match
          const [userAId, userBId] =
            userId < targetUserId
              ? [userId, targetUserId]
              : [targetUserId, userId];

          try {
            const match = await tx.match.create({
              data: { userAId, userBId, status: 'active' },
            });

            // Gather message starters
            const [startersA, startersB] = await Promise.all([
              tx.userMessageStarters.findUnique({ where: { userId } }),
              tx.userMessageStarters.findUnique({ where: { userId: targetUserId } }),
            ]);

            const allStarters = [
              ...((startersA?.starters as string[]) ?? []),
              ...((startersB?.starters as string[]) ?? []),
            ].slice(0, 3);

            const chatRoom = await tx.chatRoom.create({
              data: { matchId: match.id, starters: allStarters },
            });

            return {
              matched: true,
              matchId: match.id,
              chatRoomId: chatRoom.id,
            };
          } catch (err: unknown) {
            // Unique constraint violation — concurrent match creation
            if (err instanceof Error && 'code' in err && (err as Record<string, unknown>).code === 'P2002') {
              const existing = await tx.match.findFirst({
                where: { userAId, userBId },
                include: { chatRoom: true },
              });
              return {
                matched: true,
                matchId: existing?.id ?? null,
                chatRoomId: existing?.chatRoom?.id ?? null,
              };
            }
            throw err;
          }
        }
      }

      return { matched: false, matchId: null, chatRoomId: null };
    });

    // Send push notification for new match
    if (result.matched && result.matchId) {
      this.notificationService
        .sendNewMatch(targetUserId, currentUser?.nickname ?? 'Someone', result.matchId)
        .catch(() => {});
    }

    return result;
  }

  async getQuota(userId: string) {
    const entitlement = await this.entitlementService.getEntitlement(userId);
    if (entitlement.dailyLikeQuota === null) {
      return { used: 0, quota: null };
    }

    const dateStr = getUtcDateStr();
    const count = await this.redis.get(`likes:daily:${userId}:${dateStr}`);
    return {
      used: count ? parseInt(count, 10) : 0,
      quota: entitlement.dailyLikeQuota,
    };
  }
}
