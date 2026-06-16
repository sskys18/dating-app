import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto';

// Defaults applied for free users / unset preferences.
const DEFAULT_AGE_MIN = 18;
const DEFAULT_AGE_MAX = 99;
const DEFAULT_MAX_DISTANCE_KM = 100;
const DEFAULT_GENDER_PREF = 'all';

export interface PreferencesView {
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  genderPref: string;
  advancedEditable: boolean;
}

@Injectable()
export class PreferencesService {
  constructor(
    private prisma: PrismaService,
    private entitlementService: EntitlementService,
  ) {}

  async getPreferences(userId: string): Promise<PreferencesView> {
    const [prefs, entitlement] = await Promise.all([
      this.prisma.userPreferences.findUnique({ where: { userId } }),
      this.entitlementService.getEntitlement(userId),
    ]);

    return {
      ageMin: prefs?.ageMin ?? DEFAULT_AGE_MIN,
      ageMax: prefs?.ageMax ?? DEFAULT_AGE_MAX,
      maxDistanceKm: prefs?.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM,
      genderPref: prefs?.genderPref ?? DEFAULT_GENDER_PREF,
      advancedEditable: entitlement.advancedPrefs,
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PreferencesView> {
    const entitlement = await this.entitlementService.getEntitlement(userId);

    // Advanced fields (custom range/distance filters) are entitlement-gated.
    const touchesAdvanced =
      dto.ageMin !== undefined ||
      dto.ageMax !== undefined ||
      dto.maxDistanceKm !== undefined;

    if (touchesAdvanced && !entitlement.advancedPrefs) {
      throw new ForbiddenException(
        'Advanced preferences (age range, distance) require Plus or Premium',
      );
    }

    if (
      dto.ageMin !== undefined &&
      dto.ageMax !== undefined &&
      dto.ageMin > dto.ageMax
    ) {
      throw new BadRequestException('ageMin must be <= ageMax');
    }

    // Only persist provided fields; genderPref is basic and always allowed.
    const data: {
      ageMin?: number;
      ageMax?: number;
      maxDistanceKm?: number;
      genderPref?: string;
    } = {};
    if (dto.ageMin !== undefined) data.ageMin = dto.ageMin;
    if (dto.ageMax !== undefined) data.ageMax = dto.ageMax;
    if (dto.maxDistanceKm !== undefined) data.maxDistanceKm = dto.maxDistanceKm;
    if (dto.genderPref !== undefined) data.genderPref = dto.genderPref;

    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.getPreferences(userId);
  }
}
