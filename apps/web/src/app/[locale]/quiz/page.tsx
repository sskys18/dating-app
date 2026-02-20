'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { QuizItem } from '@dating-app/types';

export default function QuizPage() {
  const t = useTranslations('quiz');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';

  const [items, setItems] = useState<QuizItem[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(12).fill(null));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load quiz items and resume progress
  useEffect(() => {
    async function init() {
      try {
        const data = await apiFetch<{ items: QuizItem[] }>('/api/quiz/items');
        setItems(data.items);

        // Try to load saved progress from session
        try {
          const sessionData = await apiFetch<{
            quizProgress: { answers: (number | null)[]; currentIndex: number } | null;
            hasQuizResponse: boolean;
          }>('/api/anon-sessions/current');

          if (sessionData.hasQuizResponse) {
            // Already completed, go to result
            router.replace(`/${locale}/result`);
            return;
          }
          if (sessionData.quizProgress) {
            setAnswers(sessionData.quizProgress.answers);
            setCurrentIndex(sessionData.quizProgress.currentIndex);
          }
        } catch {
          // No session progress, start fresh
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load quiz');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [locale, router]);

  // Auto-save progress every 3 questions
  const saveProgress = useCallback(
    async (currentAnswers: (number | null)[], index: number) => {
      try {
        await apiFetch('/api/quiz/progress', {
          method: 'POST',
          body: JSON.stringify({
            progress: { answers: currentAnswers, currentIndex: index },
          }),
        });
      } catch {
        // Silent fail for auto-save
      }
    },
    [],
  );

  const handleAnswer = async (answer: number) => {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = answer;
    setAnswers(newAnswers);

    // Auto-save every 3 questions
    if ((currentIndex + 1) % 3 === 0) {
      await saveProgress(newAnswers, currentIndex + 1);
    }

    if (currentIndex < 11) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    const finalAnswers = answers.filter((a): a is number => a !== null);
    if (finalAnswers.length !== 12) {
      setError('Please answer all questions');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiFetch('/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: finalAnswers }),
      });
      router.push(`/${locale}/result`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-red-500">{error || 'Failed to load quiz items'}</div>
      </main>
    );
  }

  const item = items[currentIndex];
  const isKo = locale === 'ko-KR';
  const allAnswered = answers.every((a) => a !== null);
  const isLastQuestion = currentIndex === 11;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="mb-2 text-center text-sm text-gray-500">
            {t('progress', { current: currentIndex + 1, total: 12 })}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-rose-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / 12) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="mb-6 text-center text-lg font-medium text-gray-800">
            {t('title')}
          </h2>

          <div className="space-y-4">
            <button
              onClick={() => handleAnswer(0)}
              className={`w-full rounded-xl border-2 p-5 text-left transition ${
                answers[currentIndex] === 0
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                {t('optionA')}
              </span>
              <span className="text-gray-800">
                {isKo ? item.optionA.textKo : item.optionA.text}
              </span>
            </button>

            <button
              onClick={() => handleAnswer(1)}
              className={`w-full rounded-xl border-2 p-5 text-left transition ${
                answers[currentIndex] === 1
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                {t('optionB')}
              </span>
              <span className="text-gray-800">
                {isKo ? item.optionB.textKo : item.optionB.text}
              </span>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 transition hover:text-gray-700 disabled:invisible"
          >
            &larr; Back
          </button>

          {isLastQuestion && allAnswered ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full bg-rose-500 px-8 py-3 font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
            >
              {isSubmitting ? '...' : t('submit')}
            </button>
          ) : (
            <div className="text-sm text-gray-400">
              {answers[currentIndex] !== null && !isLastQuestion && (
                <span className="text-rose-500">&#x2713;</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </main>
  );
}
