import { z } from 'zod';

export const AuthProviderSchema = z.enum(['apple', 'google', 'kakao']);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const AuthRequestSchema = z.object({
  idToken: z.string().min(1),
  provider: AuthProviderSchema,
});

export type AuthRequest = z.infer<typeof AuthRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string().nullable(),
    nickname: z.string().nullable(),
    profileComplete: z.boolean(),
    role: z.string(),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const AnonSessionSchema = z.object({
  id: z.string(),
  locale: z.string(),
  expiresAt: z.string().datetime(),
});

export type AnonSession = z.infer<typeof AnonSessionSchema>;
