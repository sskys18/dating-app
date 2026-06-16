import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@dating-app/db';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ResolveReportDto } from './dto/resolve-report.dto';

const SNAPSHOT_MESSAGE_LIMIT = 50;

interface ReportSnapshot {
  capturedAt: string;
  reportedProfile: {
    id: string;
    nickname: string | null;
    bio: string | null;
    introLine: string | null;
    photoUrls: string[];
  };
  chatRoomId?: string;
  messages?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  }[];
}

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    if (reporterId === dto.reportedId) {
      throw new BadRequestException('You cannot report yourself');
    }

    const reported = await this.prisma.user.findUnique({
      where: { id: dto.reportedId },
      select: {
        id: true,
        nickname: true,
        bio: true,
        introLine: true,
        photos: {
          orderBy: { isPrimary: 'desc' },
          select: { url: true },
        },
      },
    });
    if (!reported) {
      throw new NotFoundException('Reported user not found');
    }

    // REQ-RTC-05: capture an immutable evidence snapshot at report time so ops
    // can review the case even if the user later edits their profile or the
    // conversation is deleted.
    const snapshot: ReportSnapshot = {
      capturedAt: new Date().toISOString(),
      reportedProfile: {
        id: reported.id,
        nickname: reported.nickname,
        bio: reported.bio,
        introLine: reported.introLine,
        photoUrls: reported.photos.map((p) => p.url),
      },
    };

    if (dto.chatRoomId) {
      // Only snapshot the conversation if the reporter is actually a participant.
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: dto.chatRoomId },
        include: { match: { select: { userAId: true, userBId: true } } },
      });
      const isParticipant =
        !!room &&
        (room.match.userAId === reporterId || room.match.userBId === reporterId);
      if (isParticipant) {
        const messages = await this.prisma.message.findMany({
          where: { chatRoomId: dto.chatRoomId },
          orderBy: { createdAt: 'desc' },
          take: SNAPSHOT_MESSAGE_LIMIT,
          select: { id: true, senderId: true, content: true, createdAt: true },
        });
        snapshot.chatRoomId = dto.chatRoomId;
        snapshot.messages = messages.reverse().map((m) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        }));
      }
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedId: dto.reportedId,
        reason: dto.reason,
        description: dto.description,
        snapshot: snapshot as unknown as Prisma.InputJsonObject,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return {
      success: true,
      reportId: report.id,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  // --- Admin surface (role-guarded). Backs the future admin console UI. ---

  async listReports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, nickname: true } },
        reported: { select: { id: true, nickname: true, status: true } },
      },
    });
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, reportedId: true },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: dto.status,
          resolvedAt: new Date(),
          resolvedBy: adminId,
        },
      });

      // Optional moderation action. A banned user is rejected at auth
      // (JwtStrategy checks status === 'active') and filtered from the feed.
      if (dto.banReported) {
        await tx.user.update({
          where: { id: report.reportedId },
          data: { status: 'banned' },
        });
      }
    });

    return { success: true };
  }
}
