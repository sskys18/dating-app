interface TypePoles {
  axisAPole: string;
  axisBPole: string;
  axisCPole: string;
  axisDPole: string;
}

interface AxisWeights {
  axisA?: number;
  axisB?: number;
  axisC?: number;
  axisD?: number;
}

/**
 * Alignment score (REQ-FEED-02 base): axis pole compatibility with weights
 * from UserMatchingCriteria. Range 0-95.
 */
export function computeRealCompatibility(
  userType: TypePoles,
  candidateType: TypePoles,
  weights?: AxisWeights,
): number {
  let score = 60;

  // Same closeness pole = good
  if (userType.axisAPole === candidateType.axisAPole)
    score += 10 * (weights?.axisA ?? 1.0);

  // Complementary reassurance
  if (userType.axisBPole !== candidateType.axisBPole)
    score += 10 * (weights?.axisB ?? 1.0);

  // Same commitment
  if (userType.axisCPole === candidateType.axisCPole)
    score += 8 * (weights?.axisC ?? 1.0);

  // Complementary conflict style
  if (userType.axisDPole !== candidateType.axisDPole)
    score += 7 * (weights?.axisD ?? 1.0);

  return Math.max(0, Math.min(95, Math.round(score)));
}

/**
 * Great-circle distance in km between two lat/lng points (haversine).
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Preference-fit signal in [0, 1]: how well a candidate sits inside the
 * viewer's declared search preferences. Soft signal — hard filtering is done
 * separately in eligibility. Components: age inside range, distance inside
 * radius, gender match. Missing data is treated as neutral (fit = 1).
 */
export interface PreferenceFitInput {
  ageMin?: number | null;
  ageMax?: number | null;
  maxDistanceKm?: number | null;
  genderPref?: string | null; // male | female | all
}

export function computePreferenceFit(
  prefs: PreferenceFitInput,
  candidate: {
    age: number | null;
    distanceKm: number | null;
    gender: string | null;
  },
): number {
  const parts: number[] = [];

  // Age fit: 1 inside range, decays linearly to 0 over a 10-year margin.
  if (candidate.age !== null && (prefs.ageMin != null || prefs.ageMax != null)) {
    const min = prefs.ageMin ?? 0;
    const max = prefs.ageMax ?? 200;
    if (candidate.age >= min && candidate.age <= max) {
      parts.push(1);
    } else {
      const overshoot =
        candidate.age < min ? min - candidate.age : candidate.age - max;
      parts.push(Math.max(0, 1 - overshoot / 10));
    }
  }

  // Distance fit: 1 at 0km, decays to 0 at the radius edge.
  if (candidate.distanceKm !== null && prefs.maxDistanceKm != null) {
    parts.push(
      Math.max(0, Math.min(1, 1 - candidate.distanceKm / prefs.maxDistanceKm)),
    );
  }

  // Gender fit: exact 1 / 0. "all" or missing pref is neutral.
  if (prefs.genderPref && prefs.genderPref !== 'all' && candidate.gender) {
    parts.push(candidate.gender === prefs.genderPref ? 1 : 0);
  }

  if (parts.length === 0) return 1; // no preferences declared → neutral
  return parts.reduce((s, p) => s + p, 0) / parts.length;
}

/**
 * Mild activity-recency signal in [0, 1] from lastActiveAt. 1 within the last
 * day, decaying to 0 across ~30 days of inactivity.
 */
export function computeActivitySignal(lastActiveAt: Date | null): number {
  if (!lastActiveAt) return 0;
  // Quantize to WHOLE days so this value — and therefore the composite sort
  // score — is stable across a paging session (cursor stability, REQ-FEED-05).
  // A continuous Date.now() ramp drifted the score between page requests, which
  // moved candidates across the (score, userId) cursor boundary and caused
  // cross-page duplicates/skips. A paging session lasts seconds, far less than
  // a day, so the rank key is now reproducible while still decaying over ~30d.
  const days = Math.floor((Date.now() - lastActiveAt.getTime()) / 86_400_000);
  if (days <= 1) return 1;
  if (days >= 30) return 0;
  return 1 - (days - 1) / 29;
}

// Ranking blend weights for the three v1 inputs (REQ-FEED-02).
const PREFERENCE_FIT_WEIGHT = 10; // up to +10 ranking points
const ACTIVITY_WEIGHT = 5; // up to +5 ranking points

/**
 * Composite candidate score used by both the full feed and the Top-3 preview
 * (REQ-TOP3-01): alignment (with weights) + preference fit + mild activity
 * signal. Returned score is clamped to the FeedCard 0-100 range.
 */
export function scoreCandidate(input: {
  userType: TypePoles | null;
  candidateType: TypePoles;
  weights?: AxisWeights;
  preferenceFit?: number; // [0,1]
  activitySignal?: number; // [0,1]
}): number {
  const alignment = input.userType
    ? computeRealCompatibility(input.userType, input.candidateType, input.weights)
    : 60;

  const fit = input.preferenceFit ?? 1;
  const activity = input.activitySignal ?? 0;

  const score =
    alignment + fit * PREFERENCE_FIT_WEIGHT + activity * ACTIVITY_WEIGHT;

  return Math.max(0, Math.min(100, Math.round(score)));
}
