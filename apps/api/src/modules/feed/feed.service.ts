import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@dating-app/db';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { BlockService } from '../block/block.service';
import { NotificationService } from '../notification/notification.service';
import {
  computeRealCompatibility,
  computeActivitySignal,
  computePreferenceFit,
  haversineKm,
  calculateAge,
  scoreCandidate,
} from './feed-scoring.util';
import type { FeedCard } from '@dating-app/types';

function getUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Default discovery preferences for free users / unset preferences.
const DEFAULT_AGE_MIN = 18;
const DEFAULT_AGE_MAX = 99;
const DEFAULT_MAX_DISTANCE_KM = 100;
const DEFAULT_GENDER_PREF = 'all';

interface ResolvedPrefs {
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  genderPref: string; // male | female | all
}

// A composite cursor is base64("<score>:<userId>"); the feed is ordered by
// (score desc, userId asc) so the tuple fully anchors the next page.
function encodeCursor(score: number, userId: string): string {
  return Buffer.from(`${score}:${userId}`).toString('base64url');
}

function decodeCursor(cursor: string): { score: number; userId: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const idx = raw.indexOf(':');
    if (idx < 0) return null;
    const score = Number(raw.slice(0, idx));
    const userId = raw.slice(idx + 1);
    if (!Number.isFinite(score) || !userId) return null;
    return { score, userId };
  } catch {
    return null;
  }
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
        preferences: true,
      },
    });

    const weights = (user.matchingCriteria?.weights as Record<string, number>) ?? {};
    const prefs = this.resolvePreferences(user.preferences);

    // Viewer's effective location: travel override when entitled + active,
    // else real location.
    const viewerLoc = this.resolveViewerLocation(user, entitlement.travel);

    // ── Eligibility exclusions (REQ-FEED-01) ──────────────────────────
    const [blockedIds, seenIds, actedOnUsers, reports] = await Promise.all([
      this.blockService.getBlockedIds(userId),
      this.redis.smembers(`feed:seen:${userId}`),
      this.prisma.like.findMany({
        where: { fromUserId: userId },
        select: { toUserId: true },
      }),
      // Either direction of a report ties the two users together.
      this.prisma.report.findMany({
        where: { OR: [{ reporterId: userId }, { reportedId: userId }] },
        select: { reporterId: true, reportedId: true },
      }),
    ]);

    const reportIds = reports.map((r) =>
      r.reporterId === userId ? r.reportedId : r.reporterId,
    );

    const uniqueExclusions = [
      ...new Set([
        userId,
        ...blockedIds,
        ...seenIds,
        ...actedOnUsers.map((l) => l.toUserId),
        ...reportIds,
      ]),
    ];

    // Age range → birthDate window (SQL-level eligibility).
    const { gte: birthGte, lte: birthLte } = this.ageRangeToBirthWindow(
      prefs.ageMin,
      prefs.ageMax,
    );

    const where: Prisma.UserWhereInput = {
      id: { notIn: uniqueExclusions },
      status: 'active',
      profileComplete: true,
      // Incognito users never appear in others' feeds (REQ-FEED-01).
      incognitoEnabled: false,
      birthDate: { gte: birthGte, lte: birthLte },
    };

    if (prefs.genderPref !== 'all') {
      where.gender = prefs.genderPref;
    }

    const candidates = await this.prisma.user.findMany({
      where,
      include: {
        type: true,
        photos: { where: { isPrimary: true }, take: 1 },
      },
    });

    // ── Distance eligibility (haversine) + scoring (REQ-FEED-02) ──────
    const scored = candidates
      .filter((c) => c.type !== null)
      .map((c) => {
        const distanceKm =
          viewerLoc && c.locationLat != null && c.locationLng != null
            ? haversineKm(viewerLoc.lat, viewerLoc.lng, c.locationLat, c.locationLng)
            : null;
        const age = c.birthDate ? calculateAge(c.birthDate) : null;
        const preferenceFit = computePreferenceFit(prefs, {
          age,
          distanceKm,
          gender: c.gender,
        });
        const score = scoreCandidate({
          userType: user.type,
          candidateType: c.type!,
          weights,
          preferenceFit,
          activitySignal: computeActivitySignal(c.lastActiveAt),
        });
        return { candidate: c, score, distanceKm };
      })
      // Distance filter: only enforce when both sides have coordinates.
      .filter(
        (s) => s.distanceKm === null || s.distanceKm <= prefs.maxDistanceKm,
      )
      // Deterministic order: score desc, then userId asc (stable tie-break).
      .sort(
        (a, b) =>
          b.score - a.score || (a.candidate.id < b.candidate.id ? -1 : 1),
      );

    // Free users only ever see the Top-3 of the eligible pool.
    let pool = entitlement.fullFeed ? scored : scored.slice(0, 3);

    // ── Stable composite-cursor pagination (REQ-FEED-05) ─────────────
    // The cursor anchors by (score, userId) tuple rather than by locating the
    // last id in the pool, so seen-set churn can never restart page 1.
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        pool = pool.filter(
          (s) =>
            s.score < decoded.score ||
            (s.score === decoded.score && s.candidate.id > decoded.userId),
        );
      }
    }

    const page = pool.slice(0, limit);
    const hasMore = pool.length > limit;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor(last.score, last.candidate.id) : null;

    // Record returned ids in the 24h seen cooldown set.
    if (page.length > 0) {
      await this.redis.sadd(
        `feed:seen:${userId}`,
        ...page.map((p) => p.candidate.id),
      );
      await this.redis.expire(`feed:seen:${userId}`, 86400);
    }

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

  /**
   * Likes You (REQ-SUB-04): incoming likes with no reciprocal like.
   * Premium only (entitlement.likesYou). Priority likes are surfaced first.
   */
  async getLikesYou(userId: string): Promise<{ items: FeedCard[] }> {
    const entitlement = await this.entitlementService.getEntitlement(userId);
    if (!entitlement.likesYou) {
      throw new ForbiddenException('Likes You requires Premium');
    }

    // People who liked me, where I have NOT acted on them yet (no reciprocal
    // like/pass), excluding blocked users.
    const blockedIds = await this.blockService.getBlockedIds(userId);
    const incoming = await this.prisma.like.findMany({
      where: {
        toUserId: userId,
        action: 'like',
        fromUserId: { notIn: blockedIds },
        fromUser: {
          status: 'active',
          incognitoEnabled: false,
          // exclude if I already liked/passed them back
          likesReceived: { none: { fromUserId: userId } },
        },
      },
      include: {
        fromUser: {
          include: {
            type: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      // Priority likes first, then most recent.
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { type: true, matchingCriteria: true },
    });
    const weights =
      (user.matchingCriteria?.weights as Record<string, number>) ?? {};

    const items: FeedCard[] = incoming.map((like) => {
      const c = like.fromUser;
      const score = c.type
        ? computeRealCompatibility(user.type ?? c.type, c.type, weights)
        : 60;
      return {
        userId: c.id,
        nickname: c.nickname ?? '',
        age: c.birthDate ? calculateAge(c.birthDate) : 0,
        introLine: c.introLine,
        photoUrl: c.photos[0]?.url ?? '',
        locationLabel: c.locationLabel,
        compatibilityScore: score,
        typeLabel: c.typeVisible ? (c.type?.label ?? null) : null,
      };
    });

    return { items };
  }

  /**
   * Rewind (REQ-SUB-04): undo the user's most recent 'pass'. Plus/Premium.
   */
  async rewind(userId: string): Promise<{ undonePass: string | null }> {
    const entitlement = await this.entitlementService.getEntitlement(userId);
    if (!entitlement.rewind) {
      throw new ForbiddenException('Rewind requires Plus or Premium');
    }

    const lastPass = await this.prisma.like.findFirst({
      where: { fromUserId: userId, action: 'pass' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastPass) {
      return { undonePass: null };
    }

    await this.prisma.like.delete({ where: { id: lastPass.id } });
    // Let the passed user re-surface in the feed.
    await this.redis.srem(`feed:seen:${userId}`, lastPass.toUserId);

    return { undonePass: lastPass.toUserId };
  }

  async likeOrPass(userId: string, targetUserId: string, action: 'like' | 'pass') {
    // Check block
    const blocked = await this.blockService.isBlocked(userId, targetUserId);
    if (blocked) {
      throw new ForbiddenException('Cannot interact with this user');
    }

    const entitlement = await this.entitlementService.getEntitlement(userId);

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

      if (
        entitlement.dailyLikeQuota !== null &&
        count > entitlement.dailyLikeQuota
      ) {
        // Decrement back since we already incremented
        await this.redis.decr(quotaKey);
        throw new ForbiddenException('Daily like quota exceeded');
      }
    }

    // Priority likes (REQ-SUB-04): flag likes from entitled users so they
    // rank ahead in the recipient's Likes You / feed.
    const priority = action === 'like' && entitlement.priorityLikes;

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
        create: { fromUserId: userId, toUserId: targetUserId, action, priority },
        update: { action, priority },
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

  /**
   * Incognito toggle (REQ-SUB-04): Premium only. When enabled the user is
   * hidden from others' feeds (enforced in getFeed eligibility).
   */
  async setIncognito(
    userId: string,
    enabled: boolean,
  ): Promise<{ incognitoEnabled: boolean }> {
    const entitlement = await this.entitlementService.getEntitlement(userId);
    if (!entitlement.incognito) {
      throw new ForbiddenException('Incognito requires Premium');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { incognitoEnabled: enabled },
      select: { incognitoEnabled: true },
    });
    return updated;
  }

  /**
   * Travel override (REQ-SUB-04): Premium only. Set a location override or
   * clear it. Used as the viewer's location for distance filtering when active.
   */
  async setTravel(
    userId: string,
    travel: { lat: number; lng: number } | null,
  ): Promise<{ travelActive: boolean; travelLat: number | null; travelLng: number | null }> {
    const entitlement = await this.entitlementService.getEntitlement(userId);
    if (!entitlement.travel) {
      throw new ForbiddenException('Travel requires Premium');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: travel
        ? { travelLat: travel.lat, travelLng: travel.lng, travelActive: true }
        : { travelLat: null, travelLng: null, travelActive: false },
      select: { travelActive: true, travelLat: true, travelLng: true },
    });
    return updated;
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

  // ── helpers ──────────────────────────────────────────────────────

  private resolvePreferences(
    prefs: {
      ageMin: number | null;
      ageMax: number | null;
      maxDistanceKm: number | null;
      genderPref: string | null;
    } | null,
  ): ResolvedPrefs {
    return {
      ageMin: prefs?.ageMin ?? DEFAULT_AGE_MIN,
      ageMax: prefs?.ageMax ?? DEFAULT_AGE_MAX,
      maxDistanceKm: prefs?.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM,
      genderPref: prefs?.genderPref ?? DEFAULT_GENDER_PREF,
    };
  }

  private resolveViewerLocation(
    user: {
      locationLat: number | null;
      locationLng: number | null;
      travelLat: number | null;
      travelLng: number | null;
      travelActive: boolean;
    },
    travelEntitled: boolean,
  ): { lat: number; lng: number } | null {
    if (
      travelEntitled &&
      user.travelActive &&
      user.travelLat != null &&
      user.travelLng != null
    ) {
      return { lat: user.travelLat, lng: user.travelLng };
    }
    if (user.locationLat != null && user.locationLng != null) {
      return { lat: user.locationLat, lng: user.locationLng };
    }
    return null;
  }

  private ageRangeToBirthWindow(
    ageMin: number,
    ageMax: number,
  ): { gte: Date; lte: Date } {
    const now = new Date();
    // Oldest acceptable birthDate (for ageMax): born ageMax+1 years ago + 1 day.
    const gte = new Date(
      now.getFullYear() - ageMax - 1,
      now.getMonth(),
      now.getDate() + 1,
    );
    // Youngest acceptable birthDate (for ageMin): born ageMin years ago.
    const lte = new Date(
      now.getFullYear() - ageMin,
      now.getMonth(),
      now.getDate(),
    );
    return { gte, lte };
  }
}
