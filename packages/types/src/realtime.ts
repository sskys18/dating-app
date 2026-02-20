import { z } from 'zod';

export const RealtimeMessageSchema = z.object({
  id: z.string(),
  chatRoomId: z.string(),
  senderId: z.string(),
  content: z.string(),
  status: z.enum(['sent', 'delivered', 'read']),
  createdAt: z.string().datetime(),
});

export type RealtimeMessage = z.infer<typeof RealtimeMessageSchema>;

// Socket.IO events
export const SocketEvents = {
  SEND_MESSAGE: 'send_message',
  NEW_MESSAGE: 'new_message',
  MESSAGE_DELIVERED: 'message_delivered',
  MESSAGE_READ: 'message_read',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
} as const;

export const SendMessagePayloadSchema = z.object({
  chatRoomId: z.string(),
  content: z.string().min(1).max(2000),
  tempId: z.string(), // client-generated temp ID for optimistic UI
});

export type SendMessagePayload = z.infer<typeof SendMessagePayloadSchema>;

export const TypingPayloadSchema = z.object({
  chatRoomId: z.string(),
});

export type TypingPayload = z.infer<typeof TypingPayloadSchema>;
