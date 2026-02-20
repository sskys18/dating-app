'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

const FEATURES = [
  { en: 'Daily profiles', ko: '일일 프로필' },
  { en: 'Daily likes', ko: '일일 좋아요' },
  { en: 'Rewind', ko: '되돌리기' },
  { en: 'See who likes you', ko: '누가 좋아했는지 보기' },
  { en: 'Incognito mode', ko: '시크릿 모드' },
  { en: 'Priority likes', ko: '우선 좋아요' },
];

const FEATURES_KO_VALUES: Record<string, string> = {
  Unlimited: '무제한',
  '3/day': '3개/일',
  '5/day': '5개/일',
};

const PLANS = [
  {
    key: 'free' as const,
    price: '$0',
    features: ['3/day', '5/day', '—', '—', '—', '—'],
  },
  {
    key: 'plus' as const,
    price: '$9.99',
    recommended: true,
    features: ['Unlimited', 'Unlimited', '✓', '—', '—', '—'],
  },
  {
    key: 'premium' as const,
    price: '$19.99',
    features: ['Unlimited', 'Unlimited', '✓', '✓', '✓', '✓'],
  },
];

export default function PaywallPage() {
  const t = useTranslations('paywall');
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';
  const isKo = locale === 'ko-KR';

  function featureValue(value: string): string {
    if (!isKo) return value;
    return FEATURES_KO_VALUES[value] ?? value;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        {/* Plan cards */}
        <div className="mb-8 space-y-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl bg-white p-6 shadow-sm ${
                plan.recommended ? 'ring-2 ring-rose-500' : ''
              }`}
            >
              {/* Recommended badge */}
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-4 py-1 text-xs font-semibold text-white">
                  {isKo ? '추천' : 'Recommended'}
                </div>
              )}

              {/* Plan name + price */}
              <div className="mb-4 text-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {t(plan.key)}
                </h2>
                <div className="mt-1 text-2xl font-bold text-rose-500">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-400">
                    {t('monthly')}
                  </span>
                </div>
              </div>

              {/* Feature list */}
              <ul className="mb-6 space-y-3">
                {FEATURES.map((feature, i) => {
                  const value = plan.features[i];
                  const isAvailable = value !== '—';
                  return (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className={isAvailable ? 'text-gray-700' : 'text-gray-400'}>
                        {isKo ? feature.ko : feature.en}
                      </span>
                      <span
                        className={`font-medium ${
                          isAvailable ? 'text-gray-900' : 'text-gray-300'
                        }`}
                      >
                        {featureValue(value)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* CTA button for paid plans */}
              {plan.key !== 'free' && (
                <div className="text-center">
                  <button
                    onClick={() => alert(isKo ? '곧 출시됩니다!' : 'Coming soon!')}
                    className={`inline-block w-full rounded-full px-8 py-3 text-base font-semibold transition ${
                      plan.recommended
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('getApp')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
