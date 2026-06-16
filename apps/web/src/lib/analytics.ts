'use client';

import * as amplitude from '@amplitude/analytics-browser';

/**
 * Analytics wrapper around Amplitude (spec §11.1).
 *
 * Initializes lazily from NEXT_PUBLIC_AMPLITUDE_API_KEY. When the key is absent
 * (local dev, tests, previews without analytics) every call no-ops gracefully —
 * `track`/`identify` log to console.debug in development and do nothing in prod,
 * so the app works end-to-end without an Amplitude project configured.
 */

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
const isDev = process.env.NODE_ENV !== 'production';

let initialized = false;

function ensureInit(): boolean {
  if (typeof window === 'undefined') return false;
  if (!API_KEY) return false;
  if (!initialized) {
    amplitude.init(API_KEY, {
      defaultTracking: { sessions: true },
    });
    initialized = true;
  }
  return true;
}

/**
 * Emit a single analytics event. No-ops (with a dev console.debug) when no
 * Amplitude key is configured.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (!ensureInit()) {
    if (isDev) {
      console.debug('[analytics:noop] track', event, props ?? {});
    }
    return;
  }
  amplitude.track(event, props);
}

/**
 * Associate subsequent events with a user / set user properties. No-ops (with a
 * dev console.debug) when no Amplitude key is configured.
 */
export function identify(
  userId?: string,
  props?: Record<string, unknown>,
): void {
  if (!ensureInit()) {
    if (isDev) {
      console.debug('[analytics:noop] identify', userId, props ?? {});
    }
    return;
  }
  if (userId) {
    amplitude.setUserId(userId);
  }
  if (props) {
    const id = new amplitude.Identify();
    for (const [key, value] of Object.entries(props)) {
      id.set(key, value as string | number | boolean);
    }
    amplitude.identify(id);
  }
}
