import { IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';

/**
 * Discovery preferences. genderPref is "basic" (editable by everyone).
 * ageMin/ageMax/maxDistanceKm are "advanced" filters gated behind the
 * advancedPrefs entitlement (Plus/Premium); free users keep defaults.
 */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  ageMax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxDistanceKm?: number;

  @IsOptional()
  @IsIn(['male', 'female', 'all'])
  genderPref?: 'male' | 'female' | 'all';
}
