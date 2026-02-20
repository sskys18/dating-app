import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { QUIZ_ITEMS } from '@dating-app/types';
import { Prisma } from '@dating-app/db';

export type AxisScores = {
  [key: string]: number;
  a: number;
  b: number;
  c: number;
  d: number;
};

export type AxisPoles = {
  [key: string]: string;
  a: 'CLOSE' | 'DIST';
  b: 'CALM' | 'NEED';
  c: 'COMMIT' | 'EXPLORE';
  d: 'ENGAGE' | 'PAUSE';
};

@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  getItems() {
    return QUIZ_ITEMS;
  }

  async saveProgress(sessionId: string, progress: { answers: (number | null)[]; currentIndex: number }) {
    const existing = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
    });

    if (existing?.completedAt) {
      throw new BadRequestException('Quiz already completed');
    }

    if (existing) {
      return this.prisma.quizResponse.update({
        where: { sessionId },
        data: { progress },
      });
    }

    // Create a placeholder quiz response for progress tracking
    return this.prisma.quizResponse.create({
      data: {
        sessionId,
        answers: [],
        axisScores: { a: 0, b: 0, c: 0, d: 0 },
        axisPoles: { a: 'CLOSE', b: 'CALM', c: 'COMMIT', d: 'ENGAGE' },
        typeId: 0,
        progress,
      },
    });
  }

  async getResult(sessionId: string) {
    const quizResponse = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
    });

    if (!quizResponse?.completedAt) {
      throw new NotFoundException('No completed quiz found for this session');
    }

    const type = await this.prisma.typeCatalog.findUnique({
      where: { id: quizResponse.typeId },
    });

    return {
      quizResponseId: quizResponse.id,
      typeId: quizResponse.typeId,
      axisScores: quizResponse.axisScores,
      axisPoles: quizResponse.axisPoles,
      type: type
        ? { code: type.code, label: type.label, description: type.description }
        : null,
    };
  }

  async submit(sessionId: string, answers: number[]) {
    // Rate limit: 3 submissions per session
    const rateLimitKey = `rate:quiz:${sessionId}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) {
      await this.redis.expire(rateLimitKey, 3600);
    }
    if (count > 3) {
      throw new BadRequestException('Too many submissions. Please try again later.');
    }

    // Validate answers
    if (answers.length !== 12) {
      throw new BadRequestException('Exactly 12 answers required');
    }
    if (!answers.every((a) => a === 0 || a === 1)) {
      throw new BadRequestException('Each answer must be 0 or 1');
    }

    // Check session exists
    const session = await this.prisma.anonSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new NotFoundException('Session not found or expired');
    }

    // Check not already completed
    const existing = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
    });
    if (existing?.completedAt) {
      // Return existing result (idempotent)
      const type = await this.prisma.typeCatalog.findUnique({
        where: { id: existing.typeId },
      });
      return {
        quizResponseId: existing.id,
        typeId: existing.typeId,
        axisScores: existing.axisScores,
        axisPoles: existing.axisPoles,
        type: type ? { code: type.code, label: type.label, description: type.description } : null,
      };
    }

    // Compute scores
    const axisScores = this.computeAxisScores(answers);
    const axisPoles = this.computeAxisPoles(axisScores);
    const typeId = this.computeTypeId(axisPoles);

    // Fetch type info
    const type = await this.prisma.typeCatalog.findUnique({
      where: { id: typeId },
    });

    if (!type) {
      throw new Error(`Type ${typeId} not found in catalog`);
    }

    // Upsert quiz response
    const quizResponse = existing
      ? await this.prisma.quizResponse.update({
          where: { sessionId },
          data: {
            answers,
            axisScores,
            axisPoles,
            typeId,
            progress: Prisma.JsonNull,
            completedAt: new Date(),
          },
        })
      : await this.prisma.quizResponse.create({
          data: {
            sessionId,
            answers,
            axisScores,
            axisPoles,
            typeId,
            completedAt: new Date(),
          },
        });

    return {
      quizResponseId: quizResponse.id,
      typeId,
      axisScores,
      axisPoles,
      type: {
        code: type.code,
        label: type.label,
        description: type.description,
      },
    };
  }

  /**
   * Score each axis: count how many B answers (value=1) per axis.
   * Each axis has 3 items, so scores are 0-3.
   */
  private computeAxisScores(answers: number[]): AxisScores {
    const scores: AxisScores = { a: 0, b: 0, c: 0, d: 0 };

    QUIZ_ITEMS.forEach((item, index) => {
      if (answers[index] === 1) {
        scores[item.axis as keyof AxisScores]++;
      }
    });

    return scores;
  }

  /**
   * Determine axis poles: score >= 2 means second pole, otherwise first pole.
   */
  private computeAxisPoles(scores: AxisScores): AxisPoles {
    return {
      a: scores.a >= 2 ? 'DIST' : 'CLOSE',
      b: scores.b >= 2 ? 'NEED' : 'CALM',
      c: scores.c >= 2 ? 'EXPLORE' : 'COMMIT',
      d: scores.d >= 2 ? 'PAUSE' : 'ENGAGE',
    };
  }

  /**
   * Binary encoding: A(CLOSE=0,DIST=1) B(CALM=0,NEED=1) C(COMMIT=0,EXPLORE=1) D(ENGAGE=0,PAUSE=1)
   * type_id = (a_bit << 3) | (b_bit << 2) | (c_bit << 1) | d_bit
   */
  private computeTypeId(poles: AxisPoles): number {
    const a = poles.a === 'DIST' ? 1 : 0;
    const b = poles.b === 'NEED' ? 1 : 0;
    const c = poles.c === 'EXPLORE' ? 1 : 0;
    const d = poles.d === 'PAUSE' ? 1 : 0;
    return (a << 3) | (b << 2) | (c << 1) | d;
  }
}
