import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { PhotoService } from '../photo/photo.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private photoService: PhotoService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: {
          where: { status: 'approved' },
          orderBy: { position: 'asc' },
          select: { id: true, url: true, position: true, isPrimary: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    let age: number | null = null;
    if (user.birthDate) {
      const now = new Date();
      const birth = new Date(user.birthDate);
      age = now.getFullYear() - birth.getFullYear();
      const monthDiff = now.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
    }

    return {
      id: user.id,
      nickname: user.nickname,
      age,
      gender: user.gender,
      bio: user.bio,
      introLine: user.introLine,
      locationLabel: user.locationLabel,
      typeId: user.typeId,
      typeVisible: user.typeVisible,
      axisCVisible: user.axisCVisible,
      profileComplete: user.profileComplete,
      photos: user.photos,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: Record<string, unknown> = {};

    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.introLine !== undefined) updateData.introLine = data.introLine;
    if (data.locationLat !== undefined) updateData.locationLat = data.locationLat;
    if (data.locationLng !== undefined) updateData.locationLng = data.locationLng;
    if (data.locationLabel !== undefined) updateData.locationLabel = data.locationLabel;
    if (data.typeVisible !== undefined) updateData.typeVisible = data.typeVisible;
    if (data.axisCVisible !== undefined) updateData.axisCVisible = data.axisCVisible;

    await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.photoService.checkAndUpdateCompletion(userId);

    return this.getProfile(userId);
  }

  async getDrafts(userId: string) {
    const handoffToken = await this.prisma.handoffToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!handoffToken) return null;

    const chatSession = await this.prisma.chatSession.findUnique({
      where: { sessionId: handoffToken.sessionId },
      select: { profileDraft: true },
    });

    if (!chatSession?.profileDraft) return null;

    const draft = chatSession.profileDraft as Record<string, unknown>;
    return {
      bioVariants: draft.bioVariants ?? null,
      promptAnswers: draft.promptAnswers ?? null,
    };
  }
}
