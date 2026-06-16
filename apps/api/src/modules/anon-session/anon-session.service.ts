import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class AnonSessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(ip: string, userAgent: string | undefined, locale: string) {
    // Rate limit: 5 sessions per IP per hour
    const ipHash = this.hashIp(ip);
    const rateLimitKey = `rate:anon:${ipHash}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) {
      await this.redis.expire(rateLimitKey, 3600);
    }
    if (count > 5) {
      throw new BadRequestException('Rate limit exceeded. Please try again later.');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL

    const session = await this.prisma.anonSession.create({
      data: {
        ipHash,
        userAgent: userAgent?.substring(0, 512),
        locale,
        expiresAt,
      },
    });

    return session;
  }

  async findById(id: string): Promise<{
    id: string;
    locale: string;
    expiresAt: Date;
    quizResponse: { completedAt: Date | null; progress: unknown } | null;
    chatSession: { id: string } | null;
  } | null> {
    const session = await this.prisma.anonSession.findUnique({
      where: { id },
      include: {
        quizResponse: true,
        chatSession: true,
      },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) return null;

    return session;
  }

  private hashIp(ip: string): string {
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }
}
