import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FeedCard } from '@dating-app/types';
import { randomUUID } from 'crypto';

const FAKE_PROFILES = [
  { nickname: 'Alex', nicknameKo: '\uc9c0\ubbfc' },
  { nickname: 'Jordan', nicknameKo: '\uc11c\uc5f0' },
  { nickname: 'Riley', nicknameKo: '\ud558\uc900' },
  { nickname: 'Morgan', nicknameKo: '\uc608\uc740' },
  { nickname: 'Casey', nicknameKo: '\ub3c4\uc724' },
  { nickname: 'Taylor', nicknameKo: '\uc218\ube48' },
];

function seededRandom(sessionId: string, typeId: number, min: number, max: number): number {
  const hash = (sessionId.charCodeAt(0) * 31 + typeId * 17) % (max - min + 1);
  return min + hash;
}

interface TypeCatalogEntry {
  id: number;
  code: string;
  label: string;
  labelKo: string;
  description: string;
  descriptionKo: string;
  axisAPole: string;
  axisBPole: string;
  axisCPole: string;
  axisDPole: string;
}

function computeCompatibility(
  userType: TypeCatalogEntry,
  matchType: TypeCatalogEntry,
  sessionId: string,
): number {
  let score = 60;

  // Same closeness pole = good (both want intimacy OR both want space)
  if (userType.axisAPole === matchType.axisAPole) score += 10;

  // Complementary reassurance (CALM+NEED balances)
  if (userType.axisBPole !== matchType.axisBPole) score += 10;

  // Same commitment pole
  if (userType.axisCPole === matchType.axisCPole) score += 8;

  // Complementary conflict style
  if (userType.axisDPole !== matchType.axisDPole) score += 7;

  // Deterministic variation 0-10
  score += seededRandom(sessionId, matchType.id, 0, 10);

  return Math.min(score, 95);
}

@Injectable()
export class PreviewService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getMatches(sessionId: string): Promise<{ matches: FeedCard[] }> {
    // 1. Check Redis cache
    const cacheKey = `preview:${sessionId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Load QuizResponse (must be completed)
    const quizResponse = await this.prisma.quizResponse.findUnique({
      where: { sessionId },
    });

    if (!quizResponse?.completedAt) {
      throw new NotFoundException('No completed quiz found for this session');
    }

    // 3. Load user's TypeCatalog entry
    const userType = await this.prisma.typeCatalog.findUnique({
      where: { id: quizResponse.typeId },
    });

    if (!userType) {
      throw new NotFoundException('User type not found');
    }

    // 4. Load AnonSession for locale
    const session = await this.prisma.anonSession.findUnique({
      where: { id: sessionId },
    });

    const locale = session?.locale ?? 'en-US';

    // 5. Load all 16 TypeCatalog entries
    const allTypes = await this.prisma.typeCatalog.findMany();

    // 6. Filter out user's own type, compute compatibility
    const candidates = allTypes
      .filter((t) => t.id !== userType.id)
      .map((matchType) => ({
        type: matchType,
        score: computeCompatibility(userType, matchType, sessionId),
      }));

    // 7. Sort by score descending, pick top 3
    candidates.sort((a, b) => b.score - a.score);
    const top3 = candidates.slice(0, 3);

    // 8. Build FeedCard objects
    const matches: FeedCard[] = top3.map((candidate, i) => ({
      userId: randomUUID(),
      nickname:
        locale === 'ko-KR'
          ? FAKE_PROFILES[i].nicknameKo
          : FAKE_PROFILES[i].nickname,
      age: 24 + seededRandom(sessionId, candidate.type.id, 0, 8),
      introLine:
        locale === 'ko-KR'
          ? candidate.type.descriptionKo
          : candidate.type.description,
      photoUrl: `/placeholder-${i + 1}.jpg`,
      locationLabel: null,
      compatibilityScore: candidate.score,
      typeLabel:
        locale === 'ko-KR' ? candidate.type.labelKo : candidate.type.label,
    }));

    // 9. Cache with 1 hour TTL
    const result = { matches };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);

    // 10. Return
    return result;
  }
}
