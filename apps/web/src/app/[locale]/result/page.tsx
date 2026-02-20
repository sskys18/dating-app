'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface QuizResult {
  quizResponseId: string;
  typeId: number;
  axisScores: { a: number; b: number; c: number; d: number };
  axisPoles: { a: string; b: string; c: string; d: string };
  type: {
    code: string;
    label: string;
    description: string;
  };
}

const AXIS_LABELS = {
  a: { name: 'Avoidance', nameKo: '회피', poles: ['CLOSE', 'DIST'], polesKo: ['친밀', '독립'] },
  b: { name: 'Anxiety', nameKo: '불안', poles: ['CALM', 'NEED'], polesKo: ['안정', '확인'] },
  c: { name: 'Orientation', nameKo: '지향', poles: ['COMMIT', 'EXPLORE'], polesKo: ['헌신', '탐색'] },
  d: { name: 'Conflict', nameKo: '갈등', poles: ['ENGAGE', 'PAUSE'], polesKo: ['직면', '회피'] },
} as const;

export default function ResultPage() {
  const t = useTranslations('result');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';
  const isKo = locale === 'ko-KR';

  const [result, setResult] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      try {
        // Get session to find quiz response
        const session = await apiFetch<{
          id: string;
          hasQuizResponse: boolean;
        }>('/api/anon-sessions/current');

        if (!session.hasQuizResponse) {
          router.replace(`/${locale}/quiz`);
          return;
        }

        // Submit with empty to get existing result (idempotent)
        const data = await apiFetch<QuizResult>(`/api/quiz/result`);
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load result');
      } finally {
        setIsLoading(false);
      }
    }
    loadResult();
  }, [locale, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading your results...</div>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500">{error || 'No results found'}</p>
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
        {/* Type result */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">&#x2728;</div>
          <h1 className="mb-2 text-3xl font-bold">
            {t('title', { type: result.type.label })}
          </h1>
          <p className="text-gray-600">{result.type.description}</p>
        </div>

        {/* Axis breakdown */}
        <div className="mb-8 rounded-2xl bg-gray-50 p-6">
          <h2 className="mb-4 text-center text-lg font-semibold">{t('axisBreakdown')}</h2>
          <div className="space-y-4">
            {(Object.keys(AXIS_LABELS) as Array<keyof typeof AXIS_LABELS>).map((axis) => {
              const info = AXIS_LABELS[axis];
              const score = result.axisScores[axis];
              const pole = result.axisPoles[axis];
              const isSecondPole = pole === info.poles[1];
              const poleLabel = isKo
                ? info.polesKo[isSecondPole ? 1 : 0]
                : info.poles[isSecondPole ? 1 : 0];

              return (
                <div key={axis} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {isKo ? info.polesKo[0] : info.poles[0]}
                    </span>
                    <span className="font-medium text-gray-800">
                      {isKo ? info.nameKo : info.name}: {poleLabel}
                    </span>
                    <span className="text-gray-500">
                      {isKo ? info.polesKo[1] : info.poles[1]}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-2 flex-1 rounded-full ${
                          i < score
                            ? 'bg-rose-400'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disclaimers (COPY-01, COPY-02, COPY-03) */}
        <div className="mb-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <p key={i} className="text-center text-xs text-gray-400">
              {t(`disclaimer${i}` as 'disclaimer1' | 'disclaimer2' | 'disclaimer3')}
            </p>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/${locale}/chat`)}
            className="inline-block rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-rose-600"
          >
            {t('cta')}
          </button>
        </div>
      </div>
    </main>
  );
}
