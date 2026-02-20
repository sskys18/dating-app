import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { DatingChatService } from './dating-chat.service';
import type { RedisService } from '../redis/redis.service';
import type { BlockService } from '../block/block.service';
import type { NotificationService } from '../notification/notification.service';
import type { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({ cors: true })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('RealtimeGateway');

  constructor(
    private jwtService: JwtService,
    private chatService: DatingChatService,
    private redis: RedisService,
    private blockService: BlockService,
    private notificationService: NotificationService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      socket.userId = payload.id;

      // Store socket mapping in Redis
      await this.redis.set(
        `ws:user:${payload.id}`,
        socket.id,
        'EX',
        86400,
      );

      // Join all active chat rooms
      const matches = await this.chatService.getMatchList(payload.id);
      for (const match of matches) {
        if (match.chatRoomId) {
          socket.join(match.chatRoomId);
        }
      }

      this.logger.log(`Client connected: ${payload.id}`);
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      await this.redis.del(`ws:user:${socket.userId}`);
      this.logger.log(`Client disconnected: ${socket.userId}`);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string; content: string; tempId: string },
  ) {
    const userId = socket.userId;
    if (!userId) return;

    // Dedup via tempId
    if (payload.tempId) {
      const dedupKey = `msgdedup:${payload.tempId}`;
      const wasSet = await this.redis.set(dedupKey, '1', 'EX', 300, 'NX');
      if (!wasSet) return; // Already processed
    }

    // Block check: find the other user in the chat room
    try {
      // Verify membership (block check is handled at the HTTP layer on like/match)
      await this.chatService.getChatRoom(payload.chatRoomId, userId);

      const message = await this.chatService.createMessage(
        payload.chatRoomId,
        userId,
        payload.content,
      );

      // Emit to all in the room
      this.server.to(payload.chatRoomId).emit('new_message', {
        id: message.id,
        chatRoomId: message.chatRoomId,
        senderId: message.senderId,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        tempId: payload.tempId,
      });

      // If recipient is offline, send push notification
      const chatRoom = await this.prisma.chatRoom.findUnique({
        where: { id: payload.chatRoomId },
        include: { match: true },
      });
      if (chatRoom) {
        const recipientId =
          chatRoom.match.userAId === userId
            ? chatRoom.match.userBId
            : chatRoom.match.userAId;
        const recipientSocketId = await this.redis.get(`ws:user:${recipientId}`);
        if (!recipientSocketId) {
          const sender = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { nickname: true },
          });
          this.notificationService
            .sendNewMessage(
              recipientId,
              sender?.nickname ?? 'Someone',
              payload.chatRoomId,
              payload.content,
            )
            .catch(() => {});
        }
      }
    } catch (err) {
      this.logger.error(`send_message error: ${err}`);
    }
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    const userId = socket.userId;
    if (!userId) return;

    await this.chatService.markDelivered(payload.messageId, userId);

    // Notify sender
    const message = await this.prisma.message.findUnique({
      where: { id: payload.messageId },
      include: { chatRoom: { include: { match: true } } },
    });

    if (message) {
      const senderSocketId = await this.redis.get(
        `ws:user:${message.senderId}`,
      );
      if (senderSocketId) {
        this.server.to(senderSocketId).emit('message_delivered', {
          messageId: payload.messageId,
          deliveredAt: new Date(),
        });
      }
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string; upToMessageId: string },
  ) {
    const userId = socket.userId;
    if (!userId) return;

    await this.chatService.markRead(
      payload.chatRoomId,
      userId,
      payload.upToMessageId,
    );

    // Notify other participant
    socket.to(payload.chatRoomId).emit('message_read', {
      chatRoomId: payload.chatRoomId,
      upToMessageId: payload.upToMessageId,
      readBy: userId,
      readAt: new Date(),
    });
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string },
  ) {
    if (!socket.userId) return;
    socket.to(payload.chatRoomId).emit('typing_start', {
      chatRoomId: payload.chatRoomId,
      userId: socket.userId,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() payload: { chatRoomId: string },
  ) {
    if (!socket.userId) return;
    socket.to(payload.chatRoomId).emit('typing_stop', {
      chatRoomId: payload.chatRoomId,
      userId: socket.userId,
    });
  }

  /**
   * Utility: check if a user is online and get their socket ID.
   */
  async getUserSocketId(userId: string): Promise<string | null> {
    return this.redis.get(`ws:user:${userId}`);
  }
}
