import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import type { PrismaService } from '@/modules/prisma/prisma.service';

interface GenerateTokenResult {
  token: string;
  deepLink: string;
  expiresAt: string;
}

interface ClaimResult {
  success: boolean;
  transferred: {
    quizResponse: boolean;
    chatSession: boolean;
  };
}

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async generateToken(sessionId: string): Promise<GenerateTokenResult> {
    // 1. Verify session has completed quiz
    const quizResponse = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
      select: { completedAt: true },
    });

    if (!quizResponse || !quizResponse.completedAt) {
      throw new BadRequestException('Quiz must be completed before requesting a handoff token');
    }

    // 2. Check for existing unexpired unclaimed token (idempotent)
    const existingToken = await this.prisma.handoffToken.findFirst({
      where: {
        sessionId,
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingToken) {
      const appDomain = this.config.get<string>('APP_DOMAIN', 'localhost:3000');
      return {
        token: existingToken.token,
        deepLink: `https://${appDomain}/handoff?token=${existingToken.token}`,
        expiresAt: existingToken.expiresAt.toISOString(),
      };
    }

    // 3. Generate new token
    const token = crypto.randomBytes(64).toString('hex');
    const ttlSeconds = this.config.get<number>('HANDOFF_TOKEN_TTL', 900);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.handoffToken.create({
      data: { token, sessionId, expiresAt },
    });

    const appDomain = this.config.get<string>('APP_DOMAIN', 'localhost:3000');
    return {
      token,
      deepLink: `https://${appDomain}/handoff?token=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async claimToken(token: string, userId: string): Promise<ClaimResult> {
    // 1. Find the handoff token
    const handoffToken = await this.prisma.handoffToken.findUnique({
      where: { token },
    });

    if (!handoffToken) {
      throw new NotFoundException('Handoff token not found');
    }

    // 2. Check expiration
    if (handoffToken.expiresAt < new Date()) {
      throw new BadRequestException('Handoff token has expired');
    }

    // 3. Idempotent: already claimed by same user
    if (handoffToken.claimedAt && handoffToken.userId === userId) {
      return {
        success: true,
        transferred: { quizResponse: true, chatSession: true },
      };
    }

    // 4. Conflict: claimed by a different user
    if (handoffToken.claimedAt && handoffToken.userId !== userId) {
      throw new ConflictException('Token has already been claimed by another user');
    }

    // 5. Claim and transfer data in a transaction
    const sessionId = handoffToken.sessionId;

    const [quizResponse, chatSession] = await Promise.all([
      this.prisma.quizResponse.findUnique({
        where: { sessionId },
        select: { typeId: true },
      }),
      this.prisma.chatSession.findUnique({
        where: { sessionId },
        select: { profileDraft: true, matchingCriteria: true, messageStarters: true },
      }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      // Mark token as claimed
      await tx.handoffToken.update({
        where: { token },
        data: { userId, claimedAt: new Date() },
      });

      // Transfer quiz type to user
      if (quizResponse) {
        await tx.user.update({
          where: { id: userId },
          data: { typeId: quizResponse.typeId },
        });
      }

      // Transfer chat session data to user
      if (chatSession) {
        const profileDraft = chatSession.profileDraft as Record<string, unknown> | null;
        if (profileDraft) {
          await tx.user.update({
            where: { id: userId },
            data: {
              bio: (profileDraft.bio as string) || undefined,
              introLine: (profileDraft.introLine as string) || undefined,
            },
          });
        }

        const matchingCriteria = chatSession.matchingCriteria as Record<string, unknown> | null;
        if (matchingCriteria) {
          await tx.userMatchingCriteria.upsert({
            where: { userId },
            create: {
              userId,
              dealbreakers: (matchingCriteria.dealbreakers as unknown) ?? [],
              greenFlags: (matchingCriteria.greenFlags as unknown) ?? [],
              weights: (matchingCriteria.weights as unknown) ?? {},
            },
            update: {
              dealbreakers: (matchingCriteria.dealbreakers as unknown) ?? [],
              greenFlags: (matchingCriteria.greenFlags as unknown) ?? [],
              weights: (matchingCriteria.weights as unknown) ?? {},
            },
          });
        }

        if (chatSession.messageStarters) {
          const starters = chatSession.messageStarters as Parameters<typeof tx.userMessageStarters.create>[0]['data']['starters'];
          await tx.userMessageStarters.upsert({
            where: { userId },
            create: { userId, starters },
            update: { starters },
          });
        }
      }
    });

    return {
      success: true,
      transferred: {
        quizResponse: !!quizResponse,
        chatSession: !!chatSession,
      },
    };
  }
}
