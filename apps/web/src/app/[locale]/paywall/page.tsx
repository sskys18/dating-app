'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useFlag } from '@/lib/flags';

interface HandoffResponse {
  token: string;
  deepLink: string;
  expiresAt: string;
}

// Feature rows, in display order. Labels come from paywall.features.* per locale.
const FEATURE_KEYS = [
  'dailyProfiles',
  'dailyLikes',
  'rewind',
  'likesYou',
  'incognito',
  'priorityLikes',
] as const;

// Per-plan cell values, aligned to FEATURE_KEYS order.
//   number     → "{n}/day"      'unlimited' → localized "Unlimited"
//   true       → "✓"            false       → "—"
type Cell = number | 'unlimited' | boolean;

const PLANS: {
  key: 'free' | 'plus' | 'premium';
  price: string;
  recommended?: boolean;
  values: Cell[];
}[] = [
  { key: 'free', price: '$0', values: [3, 5, false, false, false, false] },
  {
    key: 'plus',
    price: '$9.99',
    recommended: true,
    values: ['unlimited', 'unlimited', true, false, false, false],
  },
  {
    key: 'premium',
    price: '$19.99',
    values: ['unlimited', 'unlimited', true, true, true, true],
  },
];

export default function PaywallPage() {
  const t = useTranslations('paywall');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EXP-01: paywall presentation variant.
  const paywallVariant = useFlag('EXP-01');

  useEffect(() => {
    track('paywall_view', { 'EXP-01': paywallVariant });
  }, [paywallVariant]);

  function renderCell(v: Cell): string {
    if (v === 'unlimited') return t('values.unlimited');
    if (typeof v === 'number') return t('values.perDay', { count: v });
    return v ? '✓' : '—';
  }

  // WEB-06: request a one-time handoff token for the current anonymous session,
  // then deep-link into the app where auth + the actual subscription happen.
  async function handleGetApp() {
    setLoading(true);
    setError(null);
    track('purchase_start', { 'EXP-01': paywallVariant });
    try {
      const { deepLink } = await apiFetch<HandoffResponse>('/api/handoff/request', {
        method: 'POST',
      });
      track('handoff_request');
      window.location.href = deepLink;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        <div className={paywallVariant === 'compact' ? 'mb-8 space-y-2' : 'mb-8 space-y-4'}>
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl bg-white p-6 shadow-sm ${
                plan.recommended ? 'ring-2 ring-rose-500' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-4 py-1 text-xs font-semibold text-white">
                  {t('recommended')}
                </div>
              )}

              <div className="mb-4 text-center">
                <h2 className="text-xl font-bold text-gray-900">{t(plan.key)}</h2>
                <div className="mt-1 text-2xl font-bold text-rose-500">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-400">{t('monthly')}</span>
                </div>
              </div>

              <ul className="mb-6 space-y-3">
                {FEATURE_KEYS.map((featureKey, i) => {
                  const cell = plan.values[i];
                  const available = cell !== false;
                  return (
                    <li key={featureKey} className="flex items-center justify-between text-sm">
                      <span className={available ? 'text-gray-700' : 'text-gray-400'}>
                        {t(`features.${featureKey}`)}
                      </span>
                      <span
                        className={`font-medium ${available ? 'text-gray-900' : 'text-gray-300'}`}
                      >
                        {renderCell(cell)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {plan.key !== 'free' && (
                <div className="text-center">
                  <button
                    onClick={handleGetApp}
                    disabled={loading}
                    className={`inline-block w-full rounded-full px-8 py-3 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      plan.recommended
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {loading ? '…' : t('getApp')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <p className="mb-4 text-center text-sm text-rose-600">{error}</p>}
      </div>
    </main>
  );
}
