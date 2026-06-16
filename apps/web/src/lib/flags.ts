'use client';

import { useState, useEffect } from 'react';

/**
 * Experiment / feature flags (spec §11.2).
 *
 *  - EXP-01: paywall presentation
 *  - EXP-02: Top3 preview layout
 *  - EXP-03: chat length 6 vs 10 turns
 *
 * Today flags resolve to their compile-time safe defaults. The spec calls for
 * Firebase Remote Config to drive these at runtime; the seam is below.
 *
 * shortcut: default-only flag resolution. Ceiling: real Firebase Remote Config
 * (per-user/segment variants fetched at runtime). Upgrade path: implement
 * `fetchRemoteFlags()` to pull `fetchAndActivate()` values from Remote Config,
 * cache them, and have `getFlag`/`useFlag` prefer the cached remote value over
 * DEFAULT_FLAGS. No call site changes required — both accessors already read
 * through the resolver, so wiring Remote Config in is additive.
 */

export type PaywallPresentation = 'control' | 'compact';
export type Top3Layout = 'list' | 'grid';
export type ChatLength = 6 | 10;

export interface Flags {
  /** EXP-01: paywall presentation variant. */
  'EXP-01': PaywallPresentation;
  /** EXP-02: Top3 preview layout variant. */
  'EXP-02': Top3Layout;
  /** EXP-03: persona chat length (turns). */
  'EXP-03': ChatLength;
}

export type FlagKey = keyof Flags;

/** Safe defaults applied when no remote config value is available. */
const DEFAULT_FLAGS: Flags = {
  'EXP-01': 'control',
  'EXP-02': 'list',
  'EXP-03': 10,
};

/**
 * shortcut: remote values are always empty until Firebase Remote Config is wired
 * in (see file header). Resolver already prefers remote over default.
 */
const remoteFlags: Partial<Flags> = {};

/**
 * Resolve a flag value. Prefers a remote-config value when present, otherwise
 * falls back to the typed safe default. Always returns a defined value.
 */
export function getFlag<K extends FlagKey>(key: K): Flags[K] {
  return (remoteFlags[key] ?? DEFAULT_FLAGS[key]) as Flags[K];
}

/**
 * React hook accessor for a flag. Returns the resolved value and re-renders if
 * remote config is activated later (no-op today; ready for the Remote Config
 * upgrade described in the file header).
 */
export function useFlag<K extends FlagKey>(key: K): Flags[K] {
  const [value, setValue] = useState<Flags[K]>(() => getFlag(key));

  useEffect(() => {
    // Re-resolve on mount in case remote flags were activated after first paint.
    setValue(getFlag(key));
  }, [key]);

  return value;
}
