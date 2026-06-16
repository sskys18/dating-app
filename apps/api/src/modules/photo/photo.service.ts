import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { ModerationService } from './moderation.service';

const MAX_PHOTOS = 6;

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
  };
  return map[contentType] || 'jpg';
}

@Injectable()
export class PhotoService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private moderation: ModerationService,
  ) {}

  async presign(userId: string, dto: { filename: string; contentType: string }) {
    const count = await this.prisma.userPhoto.count({ where: { userId } });
    if (count >= MAX_PHOTOS) {
      throw new BadRequestException(`Maximum of ${MAX_PHOTOS} photos allowed`);
    }

    const ext = extFromContentType(dto.contentType);
    const key = `photos/${userId}/${createId()}.${ext}`;

    const photo = await this.prisma.userPhoto.create({
      data: {
        userId,
        url: key,
        position: count,
        isPrimary: count === 0,
        status: 'pending',
      },
    });

    const uploadUrl = await this.s3.generatePresignedUploadUrl(key, dto.contentType);

    return { uploadUrl, key, photoId: photo.id };
  }

  async confirm(userId: string, photoId: string) {
    const photo = await this.prisma.userPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.userId !== userId) throw new ForbiddenException();
    if (photo.status !== 'pending') {
      throw new BadRequestException('Photo is not in pending status');
    }

    await this.s3.headObject(photo.url);

    const original = await this.s3.getObject(photo.url);
    // sharp() drops all metadata by default (verified empirically — no
    // .withMetadata() call), so this also strips EXIF/GPS. .rotate() bakes
    // orientation into pixels and removes the orientation tag.
    const stripped = await sharp(original).rotate().toBuffer();

    // Moderate the exact bytes we would serve before approving.
    const verdict = await this.moderation.moderate(stripped);

    if (verdict.available && !verdict.ok) {
      // Rekognition flagged NSFW/violence/etc. — reject and leave the original
      // in S3 unmodified (no CDN url, no approval).
      await this.prisma.userPhoto.update({
        where: { id: photoId },
        data: { status: 'rejected' },
      });
      await this.checkAndUpdateCompletion(userId);
      throw new BadRequestException(verdict.reason);
    }

    if (!verdict.available) {
      // shortcut: moderation backend is unavailable (no AWS creds / API error).
      // Fail closed — leave the photo 'pending' for a human/admin to approve
      // rather than auto-approving unscanned content. Ceiling: there is no
      // admin approval UI/endpoint yet, so unscanned photos sit in 'pending'
      // indefinitely in that environment. Upgrade path: build an admin
      // moderation queue + approve endpoint, and/or wire a real moderation
      // provider so this branch is only hit on transient outages.
      throw new BadRequestException(
        'Photo could not be moderated and is awaiting manual review',
      );
    }

    // Approved by automated moderation: persist the stripped bytes and mark
    // the photo approved.
    await this.s3.putObject(photo.url, stripped, 'image/jpeg');

    const cdnUrl = this.s3.getCdnUrl(photo.url);

    const updated = await this.prisma.userPhoto.update({
      where: { id: photoId },
      data: { status: 'approved', url: cdnUrl },
    });

    await this.checkAndUpdateCompletion(userId);

    return updated;
  }

  async delete(userId: string, photoId: string) {
    const photo = await this.prisma.userPhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.userId !== userId) throw new ForbiddenException();

    try {
      await this.s3.deleteObject(photo.url);
    } catch {
      // S3 delete is best-effort
    }

    await this.prisma.userPhoto.delete({ where: { id: photoId } });

    await this.checkAndUpdateCompletion(userId);

    return { success: true };
  }

  async reorder(userId: string, photoIds: string[]) {
    const photos = await this.prisma.userPhoto.findMany({
      where: { userId },
    });

    const userPhotoIds = new Set(photos.map((p) => p.id));
    for (const id of photoIds) {
      if (!userPhotoIds.has(id)) {
        throw new BadRequestException(`Photo ${id} does not belong to user`);
      }
    }

    await this.prisma.$transaction(
      photoIds.map((id, index) =>
        this.prisma.userPhoto.update({
          where: { id },
          data: {
            position: index,
            isPrimary: index === 0,
          },
        }),
      ),
    );

    await this.checkAndUpdateCompletion(userId);

    return { success: true };
  }

  async checkAndUpdateCompletion(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        nickname: true,
        birthDate: true,
        introLine: true,
        locationLat: true,
        locationLng: true,
        locationLabel: true,
      },
    });

    if (!user) return;

    const approvedCount = await this.prisma.userPhoto.count({
      where: { userId, status: 'approved' },
    });

    const hasLocation = !!user.locationLabel || (user.locationLat != null && user.locationLng != null);
    const complete =
      !!user.nickname &&
      !!user.birthDate &&
      hasLocation &&
      !!user.introLine &&
      approvedCount >= 1;

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileComplete: complete },
    });
  }
}
