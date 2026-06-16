import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const BLOCKED_CACHE_TTL = 600; // 10 minutes

@Injectable()
export class BlockService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async blockUser(userId: string, blockedId: string) {
    // Upsert block record
    await this.prisma.block.upsert({
      where: {
        userId_blockedId: { userId, blockedId },
      },
      create: { userId, blockedId },
      update: {},
    });

    // If there's an active match between these users, unmatch
    const [userAId, userBId] =
      userId < blockedId ? [userId, blockedId] : [blockedId, userId];

    await this.prisma.match.updateMany({
      where: {
        userAId,
        userBId,
        status: 'active',
      },
      data: { status: 'unmatched' },
    });

    // Invalidate cache for both users
    await Promise.all([
      this.redis.del(`blocked:${userId}`),
      this.redis.del(`blocked:${blockedId}`),
    ]);
  }

  async unblockUser(userId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { userId, blockedId },
    });

    await Promise.all([
      this.redis.del(`blocked:${userId}`),
      this.redis.del(`blocked:${blockedId}`),
    ]);
  }

  async getBlockedIds(userId: string): Promise<string[]> {
    const cacheKey = `blocked:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get blocks in both directions
    const blocks = await this.prisma.block.findMany({
      where: {
        OR: [{ userId }, { blockedId: userId }],
      },
      select: { userId: true, blockedId: true },
    });

    const ids = blocks.map((b) =>
      b.userId === userId ? b.blockedId : b.userId,
    );
    const uniqueIds = [...new Set(ids)];

    await this.redis.set(cacheKey, JSON.stringify(uniqueIds), 'EX', BLOCKED_CACHE_TTL);

    return uniqueIds;
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const blockedIds = await this.getBlockedIds(userA);
    return blockedIds.includes(userB);
  }

  async getBlockList(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { userId },
      include: {
        blocked: {
          select: {
            id: true,
            nickname: true,
            photos: {
              where: { isPrimary: true },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockedUser: {
        id: b.blocked.id,
        nickname: b.blocked.nickname,
        photoUrl: b.blocked.photos[0]?.url ?? null,
      },
      createdAt: b.createdAt,
    }));
  }
}
