import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DatingChatService {
  constructor(private prisma: PrismaService) {}

  private async verifyMembership(chatRoomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: chatRoomId },
      include: { match: true },
    });

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    if (room.match.userAId !== userId && room.match.userBId !== userId) {
      throw new ForbiddenException('Not a member of this chat room');
    }

    return room;
  }

  async createMessage(
    chatRoomId: string,
    senderId: string,
    content: string,
  ) {
    await this.verifyMembership(chatRoomId, senderId);

    return this.prisma.message.create({
      data: {
        chatRoomId,
        senderId,
        content,
      },
    });
  }

  async getMessages(
    chatRoomId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.verifyMembership(chatRoomId, userId);

    const messages = await this.prisma.message.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return { items, nextCursor, hasMore };
  }

  async getMatchList(userId: string) {
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        status: 'active',
      },
      include: {
        userA: {
          select: {
            id: true,
            nickname: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
        userB: {
          select: {
            id: true,
            nickname: true,
            photos: { where: { isPrimary: true }, take: 1 },
          },
        },
        chatRoom: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = await Promise.all(
      matches.map(async (match) => {
        const otherUser =
          match.userAId === userId ? match.userB : match.userA;
        const chatRoomId = match.chatRoom?.id ?? null;

        let unreadCount = 0;
        if (chatRoomId) {
          unreadCount = await this.prisma.message.count({
            where: {
              chatRoomId,
              senderId: { not: userId },
              status: { not: 'read' },
            },
          });
        }

        const lastMsg = match.chatRoom?.messages[0] ?? null;

        return {
          id: match.id,
          otherUser: {
            id: otherUser.id,
            nickname: otherUser.nickname,
            photoUrl: otherUser.photos[0]?.url ?? null,
          },
          chatRoomId,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                senderId: lastMsg.senderId,
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount,
          createdAt: match.createdAt,
        };
      }),
    );

    // Sort by last message date (or match creation if no messages)
    result.sort((a, b) => {
      const aDate = a.lastMessage?.createdAt ?? a.createdAt;
      const bDate = b.lastMessage?.createdAt ?? b.createdAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return result;
  }

  async getChatRoom(chatRoomId: string, userId: string) {
    const room = await this.verifyMembership(chatRoomId, userId);
    return {
      id: room.id,
      matchId: room.matchId,
      starters: room.starters,
      createdAt: room.createdAt,
    };
  }

  async markDelivered(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { chatRoom: { include: { match: true } } },
    });

    if (!message) return;

    // Only the recipient can mark as delivered
    const match = message.chatRoom.match;
    if (match.userAId !== userId && match.userBId !== userId) return;
    if (message.senderId === userId) return;

    await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
  }

  async markRead(chatRoomId: string, userId: string, upToMessageId: string) {
    const targetMessage = await this.prisma.message.findUnique({
      where: { id: upToMessageId },
    });

    if (!targetMessage) return;

    await this.prisma.message.updateMany({
      where: {
        chatRoomId,
        senderId: { not: userId },
        createdAt: { lte: targetMessage.createdAt },
        status: { not: 'read' },
      },
      data: { status: 'read', readAt: new Date() },
    });
  }
}
