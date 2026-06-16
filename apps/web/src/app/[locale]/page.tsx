'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { track } from '@/lib/analytics';

export default function LandingPage() {
  const t = useTranslations('landing');
  const router = useRouter();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track('landing_view');
  }, []);

  const handleStart = async () => {
    if (!ageConfirmed) return;
    setIsLoading(true);
    setError(null);

    try {
      const locale = window.location.pathname.split('/')[1] || 'en-US';
      await apiFetch<{ id: string }>(`/api/anon-sessions?locale=${locale}`, {
        method: 'POST',
      });
      router.push(`/${locale}/quiz`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8">
          <span className="text-6xl">&#x1F496;</span>
        </div>
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          {t('title')}
        </h1>
        <p className="mb-10 text-lg text-gray-600">{t('subtitle')}</p>

        <div className="mb-6 flex items-center justify-center gap-3">
          <input
            type="checkbox"
            id="age-gate"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300 text-rose-500 focus:ring-rose-500"
          />
          <label htmlFor="age-gate" className="text-sm text-gray-600">
            {t('ageGate')}
          </label>
        </div>

        <button
          onClick={handleStart}
          disabled={!ageConfirmed || isLoading}
          className="inline-block rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? '...' : t('cta')}
        </button>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <p className="mt-8 text-xs text-gray-400">
          {t('terms')}
        </p>
      </div>
    </main>
  );
}
