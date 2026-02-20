import { z } from 'zod';

export const ChatMessageRoleSchema = z.enum(['system', 'assistant', 'user']);

export const ChatMessageSchema = z.object({
  role: ChatMessageRoleSchema,
  content: z.string(),
  timestamp: z.string().datetime(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const StartChatRequestSchema = z.object({
  sessionId: z.string(),
});

export type StartChatRequest = z.infer<typeof StartChatRequestSchema>;

export const SendMessageRequestSchema = z.object({
  content: z.string().min(1).max(500),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const ChatSessionResponseSchema = z.object({
  id: z.string(),
  turnCount: z.number(),
  maxTurns: z.number(),
  messages: z.array(ChatMessageSchema),
  status: z.enum(['active', 'completed', 'expired']),
});

export type ChatSessionResponse = z.infer<typeof ChatSessionResponseSchema>;

// ─── Structured Outputs (from persona chat) ───────────────────────

export const ProfileDraftSchema = z.object({
  bioVariants: z.array(z.string()).length(2),
  promptAnswers: z.array(z.string()).length(3),
});

export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;

export const MatchingCriteriaSchema = z.object({
  dealbreakers: z.array(z.string()),
  greenFlags: z.array(z.string()),
  weights: z.record(z.string(), z.number()),
});

export type MatchingCriteria = z.infer<typeof MatchingCriteriaSchema>;

export const MessageStartersSchema = z.object({
  starters: z.array(z.string()).length(3),
});

export type MessageStarters = z.infer<typeof MessageStartersSchema>;

export const ChatOutputsSchema = z.object({
  profileDraft: ProfileDraftSchema,
  matchingCriteria: MatchingCriteriaSchema,
  messageStarters: MessageStartersSchema,
});

export type ChatOutputs = z.infer<typeof ChatOutputsSchema>;
