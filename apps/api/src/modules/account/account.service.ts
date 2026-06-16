import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../photo/s3.service';

/**
 * REQ-RET-03 + App Store account-deletion requirement.
 *
 * Soft-deletes the User row (status='deleted') rather than hard-deleting it, so
 * match/report/moderation history referencing this user stays referentially
 * intact and the freed unique constraints (email, provider) allow re-signup.
 *
 * Because the row is UPDATEd, not DELETEd, `onDelete: Cascade` never fires — so
 * every piece of PII is removed EXPLICITLY here, not via cascade:
 *   - User scalar PII nulled (email, nickname, bio, introLine, location*, ...)
 *   - 1:1 / child rows deleted (photos, device tokens, auth providers,
 *     preferences, matching criteria, message starters, subscription)
 *   - authored Message.content redacted to '[deleted]' (free-text PII)
 *   - Like edges (both directions) removed so the account stops surfacing
 * Report.snapshot rows are deliberately RETAINED as moderation evidence (a
 * lawful-basis exception to deletion); they are not user-facing.
 *
 * Idempotent: a second call on an already-deleted user is a no-op success.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  async deleteAccount(userId: string): Promise<{ status: 'deleted' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) throw new NotFoundException('User not found');

    // Idempotent: already deleted → nothing to do.
    if (user.status === 'deleted') return { status: 'deleted' };

    // Collect photo object keys up front so S3 is purged AFTER the DB commit
    // (a rollback must not orphan rows whose objects are already gone).
    const photos = await this.prisma.userPhoto.findMany({
      where: { userId },
      select: { url: true },
    });

    // Soft-delete user + null PII, redact authored messages, drop Like edges,
    // and remove user-owned 1:1 / child rows. Wrapped in a transaction so the
    // account never lands in a half-deleted state. deleteMany/updateMany are
    // inherently idempotent.
    await this.prisma.$transaction([
      // Free-text PII the soft-delete would otherwise leave behind.
      this.prisma.message.updateMany({
        where: { senderId: userId },
        data: { content: '[deleted]' },
      }),
      this.prisma.like.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      }),
      this.prisma.userPhoto.deleteMany({ where: { userId } }),
      this.prisma.deviceToken.deleteMany({ where: { userId } }),
      this.prisma.authProvider.deleteMany({ where: { userId } }),
      this.prisma.userPreferences.deleteMany({ where: { userId } }),
      this.prisma.userMatchingCriteria.deleteMany({ where: { userId } }),
      this.prisma.userMessageStarters.deleteMany({ where: { userId } }),
      this.prisma.subscription.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'deleted',
          email: null,
          nickname: null,
          bio: null,
          introLine: null,
          birthDate: null,
          gender: null,
          locationLat: null,
          locationLng: null,
          locationLabel: null,
          travelLat: null,
          travelLng: null,
          travelActive: false,
          incognitoEnabled: false,
          profileComplete: false,
          typeVisible: false,
          axisCVisible: false,
          lastActiveAt: null,
        },
      }),
    ]);

    // Best-effort S3 cleanup AFTER the DB commit. If a delete fails the object
    // is orphaned (acceptable) but the account is already consistently deleted.
    for (const photo of photos) {
      try {
        await this.s3.deleteObject(this.s3KeyFromUrl(photo.url));
      } catch {
        // best-effort; ignore
      }
    }

    this.logger.log(`Account deleted: ${userId}`);
    return { status: 'deleted' };
  }

  /**
   * Photos are stored as CDN/S3 URLs after approval and as raw keys while
   * pending. Derive the object key from either form so deletion targets the
   * right S3 object. Falls back to the stored value when it is already a key.
   */
  private s3KeyFromUrl(urlOrKey: string): string {
    if (!urlOrKey.startsWith('http://') && !urlOrKey.startsWith('https://')) {
      return urlOrKey;
    }
    try {
      const { pathname } = new URL(urlOrKey);
      return decodeURIComponent(pathname.replace(/^\/+/, ''));
    } catch {
      return urlOrKey;
    }
  }
}
