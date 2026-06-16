import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '@/modules/prisma/prisma.service';

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

    const sessionId = handoffToken.sessionId;

    // 3. Claim + transfer atomically. The `claimedAt: null` guard makes the
    //    claim single-use even under concurrent requests (HAND-03): exactly
    //    one caller wins the conditional update; others see count === 0.
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.handoffToken.updateMany({
        where: { token, claimedAt: null },
        data: { userId, claimedAt: new Date() },
      });

      if (claim.count === 0) {
        // Already claimed (previously or by a concurrent winner).
        const current = await tx.handoffToken.findUnique({
          where: { token },
          select: { userId: true },
        });
        if (current?.userId === userId) {
          // Idempotent re-claim by the same user.
          return {
            success: true,
            transferred: { quizResponse: true, chatSession: true },
          };
        }
        throw new ConflictException('Token has already been claimed by another user');
      }

      // We own the claim — transfer the anonymous outputs to this user.
      const [quizResponse, chatSession] = await Promise.all([
        tx.quizResponse.findUnique({
          where: { sessionId },
          select: { typeId: true },
        }),
        tx.chatSession.findUnique({
          where: { sessionId },
          select: { profileDraft: true, matchingCriteria: true, messageStarters: true },
        }),
      ]);

      // Transfer quiz type to user
      if (quizResponse) {
        await tx.user.update({
          where: { id: userId },
          data: { typeId: quizResponse.typeId },
        });
      }

      // Transfer chat session data to user
      if (chatSession) {
        // ProfileDraft is { bioVariants[2], promptAnswers[3] } (see ProfileDraftSchema).
        // Seed the editable bio draft with the first variant; the user fills the
        // required 1-line intro during profile setup (REQ-PROF-02: drafts, never forced).
        const profileDraft = chatSession.profileDraft as
          | { bioVariants?: string[] }
          | null;
        const firstBio = profileDraft?.bioVariants?.[0];
        if (firstBio) {
          await tx.user.update({
            where: { id: userId },
            data: { bio: firstBio },
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

      return {
        success: true,
        transferred: {
          quizResponse: !!quizResponse,
          chatSession: !!chatSession,
        },
      };
    });
  }
}
