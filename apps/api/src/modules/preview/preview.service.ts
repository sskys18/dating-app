import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { FeedCard } from '@dating-app/types';
import { scoreCandidate, computeActivitySignal, calculateAge } from '../feed/feed-scoring.util';

@Injectable()
export class PreviewService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Top-3 preview (REQ-TOP3-01): uses the SAME real-user scoring engine as the
   * full feed (scoreCandidate), against real eligible users — no synthetic
   * TypeCatalog/seededRandom profiles. Free + anonymous (REQ-TOP3-02).
   */
  async getMatches(sessionId: string, locale?: string): Promise<{ matches: FeedCard[] }> {
    // 1. Cache (per-locale: type labels are localized below)
    const cacheKey = `preview:${sessionId}:${locale ?? 'en-US'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Completed quiz required
    const quizResponse = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
    });
    if (!quizResponse?.completedAt) {
      throw new NotFoundException('No completed quiz found for this session');
    }

    // 3. The anonymous quiz-taker's type (axis poles) drives compatibility.
    const userType = await this.prisma.typeCatalog.findUnique({
      where: { id: quizResponse.typeId },
    });
    if (!userType) {
      throw new NotFoundException('User type not found');
    }

    // 4. Real eligible candidates (same base eligibility as the feed: active,
    //    complete profile, not incognito, has a computed type).
    const candidates = await this.prisma.user.findMany({
      where: {
        status: 'active',
        profileComplete: true,
        incognitoEnabled: false,
        typeId: { not: null },
      },
      include: {
        type: true,
        photos: { where: { isPrimary: true }, take: 1 },
      },
    });

    // 5. Score with the shared engine. Anonymous user has no weights/prefs, so
    //    alignment + activity drive the ranking.
    const scored = candidates
      .filter((c) => c.type !== null)
      .map((c) => ({
        candidate: c,
        score: scoreCandidate({
          userType,
          candidateType: c.type!,
          activitySignal: computeActivitySignal(c.lastActiveAt),
        }),
      }))
      .sort(
        (a, b) =>
          b.score - a.score || (a.candidate.id < b.candidate.id ? -1 : 1),
      );

    const top3 = scored.slice(0, 3);

    // 6. Build FeedCards (respect each candidate's typeVisible, like the feed).
    const matches: FeedCard[] = top3.map((s) => {
      const c = s.candidate;
      // Privacy: this preview is served to UNAUTHENTICATED anonymous visitors
      // (anon quiz-session cookie, no JWT), so it must not leak real users' PII
      // or allow enumeration/scraping. Return an opaque per-session id (not the
      // real userId), no raw CDN photo URL, and no free-text intro. The full
      // profile (real id, photo, intro) is only exposed in the authenticated
      // feed after sign-up. Teaser keeps nickname + age + city + score + type.
      const opaqueId = crypto
        .createHash('sha256')
        .update(`${c.id}:${sessionId}`)
        .digest('hex')
        .slice(0, 16);
      return {
        userId: opaqueId,
        nickname: c.nickname ?? '',
        age: c.birthDate ? calculateAge(c.birthDate) : 0,
        introLine: null,
        photoUrl: '',
        locationLabel: c.locationLabel,
        compatibilityScore: s.score,
        typeLabel:
          c.typeVisible && c.type
            ? locale === 'ko-KR'
              ? c.type.labelKo
              : locale === 'ja-JP'
                ? (c.type.labelJa ?? c.type.label)
                : c.type.label
            : null,
      };
    });

    // 7. Cache 1h
    const result = { matches };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    return result;
  }
}
