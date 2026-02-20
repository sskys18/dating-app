import { z } from 'zod';

export const UserProfileSchema = z.object({
  id: z.string(),
  nickname: z.string().nullable(),
  age: z.number().nullable(),
  gender: z.string().nullable(),
  bio: z.string().nullable(),
  introLine: z.string().nullable(),
  locationLabel: z.string().nullable(),
  typeId: z.number().nullable(),
  typeVisible: z.boolean(),
  axisCVisible: z.boolean(),
  profileComplete: z.boolean(),
  photos: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      position: z.number(),
      isPrimary: z.boolean(),
    }),
  ),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileRequestSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  gender: z.string().max(20).optional(),
  bio: z.string().max(500).optional(),
  introLine: z.string().max(200).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  locationLabel: z.string().max(100).optional(),
  typeVisible: z.boolean().optional(),
  axisCVisible: z.boolean().optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const SubscriptionPlanSchema = z.enum(['free', 'plus', 'premium']);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const EntitlementSchema = z.object({
  plan: SubscriptionPlanSchema,
  fullFeed: z.boolean(),
  unlimitedLikes: z.boolean(),
  rewind: z.boolean(),
  advancedPrefs: z.boolean(),
  likesYou: z.boolean(),
  incognito: z.boolean(),
  travel: z.boolean(),
  priorityLikes: z.boolean(),
  dailyLikeQuota: z.number().nullable(), // null = unlimited
});

export type Entitlement = z.infer<typeof EntitlementSchema>;
