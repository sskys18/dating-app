import { z } from 'zod';

export const FeedCardSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  age: z.number(),
  introLine: z.string().nullable(),
  photoUrl: z.string(),
  locationLabel: z.string().nullable(),
  compatibilityScore: z.number().min(0).max(100),
  typeLabel: z.string().nullable(), // only if user made type visible
});

export type FeedCard = z.infer<typeof FeedCardSchema>;

export const LikeActionSchema = z.enum(['like', 'pass']);
export type LikeAction = z.infer<typeof LikeActionSchema>;

export const LikeRequestSchema = z.object({
  targetUserId: z.string(),
  action: LikeActionSchema,
});

export type LikeRequest = z.infer<typeof LikeRequestSchema>;

export const LikeResponseSchema = z.object({
  matched: z.boolean(),
  matchId: z.string().nullable(),
  chatRoomId: z.string().nullable(),
});

export type LikeResponse = z.infer<typeof LikeResponseSchema>;

export const MatchSchema = z.object({
  id: z.string(),
  otherUser: z.object({
    id: z.string(),
    nickname: z.string(),
    photoUrl: z.string(),
  }),
  chatRoomId: z.string(),
  createdAt: z.string().datetime(),
});

export type Match = z.infer<typeof MatchSchema>;

export const HandoffTokenRequestSchema = z.object({
  sessionId: z.string(),
});

export type HandoffTokenRequest = z.infer<typeof HandoffTokenRequestSchema>;

export const HandoffTokenResponseSchema = z.object({
  token: z.string(),
  deepLink: z.string(),
  expiresAt: z.string().datetime(),
});

export type HandoffTokenResponse = z.infer<typeof HandoffTokenResponseSchema>;

export const ClaimHandoffRequestSchema = z.object({
  token: z.string(),
});

export type ClaimHandoffRequest = z.infer<typeof ClaimHandoffRequestSchema>;
