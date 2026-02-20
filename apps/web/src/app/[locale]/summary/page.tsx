'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ProfileDraft {
  bioVariants: string[];
  promptAnswers: string[];
}

interface MatchingCriteria {
  dealbreakers: string[];
  greenFlags: string[];
  weights: Record<string, number>;
}

interface MessageStarters {
  starters: string[];
}

interface CompletedSession {
  id: string;
  status: string;
  profileDraft: ProfileDraft;
  matchingCriteria: MatchingCriteria;
  messageStarters: MessageStarters;
}

const WEIGHT_LABELS: Record<string, { en: string; ko: string }> = {
  closeness: { en: 'Closeness', ko: '친밀감' },
  reassurance: { en: 'Reassurance', ko: '안정감' },
  commitment: { en: 'Commitment', ko: '헌신' },
  conflict: { en: 'Conflict Style', ko: '갈등 방식' },
};

export default function SummaryPage() {
  const t = useTranslations('summary');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';
  const isKo = locale === 'ko-KR';

  const [data, setData] = useState<CompletedSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await apiFetch<CompletedSession | null>(
          '/api/chat/session',
        );

        if (!session || session.status !== 'completed') {
          router.replace(`/${locale}/chat`);
          return;
        }

        setData(session);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, [locale, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading your profile draft...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500">{error || 'No results found'}</p>
          <button
            onClick={() => router.push(`/${locale}/chat`)}
            className="mt-4 text-rose-500 underline"
          >
            Back to chat
          </button>
        </div>
      </main>
    );
  }

  const { profileDraft, matchingCriteria, messageStarters } = data;

  const promptLabels = isKo
    ? ['이상적인 첫 데이트...', '이런 사람을 찾고 있어요...', '재밌는 사실 하나...']
    : ['My ideal first date...', "I'm looking for someone who...", 'A fun fact about me...'];

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>

        {/* Profile Draft */}
        <section className="mb-6 rounded-2xl bg-gray-50 p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('profileDraft')}</h2>

          {/* Bio variants */}
          <div className="mb-4 space-y-3">
            {profileDraft.bioVariants.map((bio, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-1 text-xs font-medium text-gray-400">
                  {isKo ? `자기소개 ${i + 1}` : `Bio ${i + 1}`}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{bio}</p>
              </div>
            ))}
          </div>

          {/* Prompt answers */}
          <div className="space-y-3">
            {profileDraft.promptAnswers.map((answer, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="mb-1 text-xs font-medium text-rose-400">
                  {promptLabels[i]}
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Matching Criteria */}
        <section className="mb-6 rounded-2xl bg-gray-50 p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('matchingCriteria')}</h2>

          {/* Dealbreakers */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-red-500">
              {isKo ? '절대 안 돼요' : 'Dealbreakers'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {matchingCriteria.dealbreakers.map((item, i) => (
                <span
                  key={i}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Green flags */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-green-600">
              {isKo ? '이런 게 좋아요' : 'Green Flags'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {matchingCriteria.greenFlags.map((item, i) => (
                <span
                  key={i}
                  className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-600"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Weights */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              {isKo ? '중요도' : 'Importance'}
            </h3>
            <div className="space-y-2">
              {Object.entries(matchingCriteria.weights).map(([key, value]) => {
                const label = WEIGHT_LABELS[key];
                return (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>{label ? (isKo ? label.ko : label.en) : key}</span>
                      <span>{Math.round(value * 100)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-rose-400 transition-all"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Conversation Starters */}
        <section className="mb-8 rounded-2xl bg-gray-50 p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('messageStarters')}</h2>
          <div className="space-y-3">
            {messageStarters.starters.map((starter, i) => (
              <div
                key={i}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <p className="text-sm leading-relaxed text-gray-700">
                  &ldquo;{starter}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/${locale}/preview`)}
            className="inline-block rounded-full bg-rose-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-rose-600"
          >
            {t('cta')}
          </button>
        </div>
      </div>
    </main>
  );
}
