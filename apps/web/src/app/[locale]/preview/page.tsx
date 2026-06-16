'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { track } from '@/lib/analytics';
import { useFlag } from '@/lib/flags';

interface FeedCard {
  userId: string;
  nickname: string;
  age: number;
  introLine: string | null;
  photoUrl: string;
  locationLabel: string | null;
  compatibilityScore: number;
  typeLabel: string | null;
}

export default function PreviewPage() {
  const t = useTranslations('preview');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';

  const [matches, setMatches] = useState<FeedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EXP-02: Top3 preview layout (list vs grid).
  const top3Layout = useFlag('EXP-02');

  useEffect(() => {
    async function loadMatches() {
      try {
        const data = await apiFetch<{ matches: FeedCard[] }>(
          `/api/preview/matches?locale=${locale}`,
        );
        setMatches(data.matches);
        track('preview_top3_view', {
          count: data.matches.length,
          'EXP-02': top3Layout,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load matches');
        router.replace(`/${locale}/quiz`);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    loadMatches();
  }, [locale, router, top3Layout]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading your matches...</div>
      </main>
    );
  }

  if (error || matches.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500">{error || 'No matches found'}</p>
          <button
            onClick={() => router.push(`/${locale}/quiz`)}
            className="mt-4 text-rose-500 underline"
          >
            Take the quiz
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        {/* Match cards — EXP-02: list (stacked) vs grid layout */}
        <div
          className={
            top3Layout === 'grid'
              ? 'mb-8 grid grid-cols-2 gap-4'
              : 'mb-8 space-y-4'
          }
        >
          {matches.map((match) => (
            <div
              key={match.userId}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              {/* Avatar + name row */}
              <div className="mb-4 flex items-center gap-4">
                <div className="h-20 w-20 flex-shrink-0 rounded-full bg-gradient-to-br from-rose-300 to-pink-400" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {match.nickname}, {match.age}
                  </h2>
                  {match.typeLabel && (
                    <span className="mt-1 inline-block rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-500">
                      {match.typeLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Intro line */}
              {match.introLine && (
                <p className="mb-4 text-sm leading-relaxed text-gray-600">
                  {match.introLine}
                </p>
              )}

              {/* Compatibility score */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">
                  {t('compatibility', { score: match.compatibilityScore })}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all"
                    style={{ width: `${match.compatibilityScore}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/${locale}/paywall`)}
            className="inline-block rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-rose-600"
          >
            {t('cta')}
          </button>
        </div>
      </div>
    </main>
  );
}
