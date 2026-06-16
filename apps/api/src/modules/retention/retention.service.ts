import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@dating-app/db';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

/**
 * REQ-RET-01 / REQ-RET-02: enforce data lifecycle for raw anonymous data.
 *
 * Daily job that purges RAW, short-lived anonymous data older than
 * RETENTION_DAYS while PRESERVING the long-term, structured fields:
 *  - QuizResponse: raw `answers` + `progress` are nulled; typeId, axisScores,
 *    axisPoles, quizVersion are kept.
 *  - ChatSession: raw `messages` + `systemPrompt` are cleared; structured
 *    outputs (profileDraft, matchingCriteria, messageStarters) are kept.
 *  - User profile rows are never touched here.
 *
 * Also expires stale unclaimed AnonSession + HandoffToken rows (TTL cleanup).
 *
 * The job is idempotent: each pass only matches rows that still hold raw data
 * past the cutoff, so re-running produces no further changes. Deletes are
 * batched to keep transactions small and safe under load.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get retentionDays(): number {
    const raw = this.config.get<string>('RETENTION_DAYS');
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  }

  private cutoff(): Date {
    return new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'data-retention' })
  async handleRetention(): Promise<void> {
    const cutoff = this.cutoff();
    this.logger.log(
      `Running data retention sweep (cutoff=${cutoff.toISOString()}, days=${this.retentionDays})`,
    );

    try {
      const quiz = await this.purgeQuizAnswers(cutoff);
      const chat = await this.purgeChatTranscripts(cutoff);
      const tokens = await this.expireHandoffTokens();
      const sessions = await this.expireAnonSessions();

      this.logger.log(
        `Retention sweep complete: quiz=${quiz} chat=${chat} ` +
          `handoffTokens=${tokens} anonSessions=${sessions}`,
      );
    } catch (err) {
      this.logger.error('Retention sweep failed', err as Error);
    }
  }

  /**
   * REQ-RET-01 / REQ-RET-02: clear raw quiz `answers` + `progress` past the
   * cutoff while keeping typeId / axisScores / axisPoles.
   *
   * `answers` is a required Json column, so we cannot SQL-NULL it; we overwrite
   * the raw int[] with an empty array (raw content gone, constraint kept).
   * `progress` is nullable Json → cleared to DB NULL.
   * Idempotent: only matches rows whose `answers` is not already empty.
   */
  async purgeQuizAnswers(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.quizResponse.findMany({
        where: {
          createdAt: { lt: cutoff },
          NOT: { answers: { equals: [] } },
        },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      await this.prisma.quizResponse.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { answers: [], progress: Prisma.DbNull },
      });
      total += rows.length;
      if (rows.length < BATCH_SIZE) break;
    }
    return total;
  }

  /**
   * REQ-RET-01 / REQ-RET-02: clear raw chat `messages` + `systemPrompt` past the
   * cutoff while keeping profileDraft / matchingCriteria / messageStarters.
   * Idempotent: only matches rows whose transcript is not already empty.
   */
  async purgeChatTranscripts(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.chatSession.findMany({
        where: {
          createdAt: { lt: cutoff },
          NOT: { messages: { equals: [] } },
        },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      await this.prisma.chatSession.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { messages: [], systemPrompt: null },
      });
      total += rows.length;
      if (rows.length < BATCH_SIZE) break;
    }
    return total;
  }

  /**
   * Delete handoff tokens that are past their own expiry. Single-use claimed
   * tokens are also dropped once expired. Cascade is irrelevant here (token is
   * the child); deleting it never removes the AnonSession.
   */
  async expireHandoffTokens(): Promise<number> {
    const now = new Date();
    let total = 0;
    for (;;) {
      const rows = await this.prisma.handoffToken.findMany({
        where: { expiresAt: { lt: now } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      const res = await this.prisma.handoffToken.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      total += res.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return total;
  }

  /**
   * Delete stale, unclaimed anonymous sessions past their TTL. A session is
   * "claimed" once a handoff token attached it to a user; we keep those so the
   * preserved structured outputs remain reachable. Deleting an AnonSession
   * cascades to its QuizResponse / ChatSession / HandoffToken rows.
   */
  async expireAnonSessions(): Promise<number> {
    const now = new Date();
    let total = 0;
    for (;;) {
      const rows = await this.prisma.anonSession.findMany({
        where: {
          expiresAt: { lt: now },
          handoffTokens: { none: { userId: { not: null } } },
        },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;

      const res = await this.prisma.anonSession.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      total += res.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return total;
  }
}
