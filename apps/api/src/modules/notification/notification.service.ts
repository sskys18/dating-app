import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApnsService } from './apns.service';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private apnsService: ApnsService,
  ) {}

  async registerToken(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregisterToken(token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { token },
    });
  }

  async sendNewMatch(
    recipientId: string,
    matcherNickname: string,
    matchId: string,
  ) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: recipientId },
    });

    const alert = {
      title: 'New Match!',
      body: `${matcherNickname} matched with you`,
    };

    const payload = { type: 'new_match', matchId };

    await Promise.all(
      tokens.map((t) =>
        this.apnsService.sendNotification(t.token, alert, payload),
      ),
    );
  }

  async sendNewMessage(
    recipientId: string,
    senderNickname: string,
    chatRoomId: string,
    preview: string,
  ) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: recipientId },
    });

    const truncatedPreview =
      preview.length > 100 ? preview.slice(0, 100) + '...' : preview;

    const alert = {
      title: senderNickname,
      body: truncatedPreview,
    };

    const payload = { type: 'new_message', chatRoomId };

    await Promise.all(
      tokens.map((t) =>
        this.apnsService.sendNotification(t.token, alert, payload),
      ),
    );
  }
}
