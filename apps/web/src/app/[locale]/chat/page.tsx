'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { track } from '@/lib/analytics';
import { getFlag } from '@/lib/flags';

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

interface ChatSessionResponse {
  id: string;
  turnCount: number;
  maxTurns: number;
  messages: ChatMessage[];
  status: 'active' | 'completed' | 'expired';
}

export default function ChatPage() {
  const t = useTranslations('chat');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en-US';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [maxTurns, setMaxTurns] = useState(10);
  const [status, setStatus] = useState<'active' | 'completed' | 'expired'>('active');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatCompleteTracked = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fire chat_complete once when the persona chat reaches the completed state
  // (whether on resume of a finished session or on the final message turn).
  useEffect(() => {
    if (status === 'completed' && !chatCompleteTracked.current) {
      chatCompleteTracked.current = true;
      track('chat_complete', { turnCount });
    }
  }, [status, turnCount]);

  useEffect(() => {
    async function initChat() {
      try {
        // Check for existing session
        const existing = await apiFetch<ChatSessionResponse | null>(
          '/api/chat/session',
        );

        if (existing) {
          setMessages(existing.messages);
          setTurnCount(existing.turnCount);
          setMaxTurns(existing.maxTurns);
          setStatus(existing.status);
          if (existing.status === 'completed') {
            setIsLoading(false);
            return;
          }
        }

        if (!existing) {
          // Start a new chat session
          const session = await apiFetch<ChatSessionResponse>(
            '/api/chat/start',
            { method: 'POST' },
          );
          setMessages(session.messages);
          setTurnCount(session.turnCount);
          setMaxTurns(session.maxTurns);
          setStatus(session.status);
          // EXP-03: chat length (6 vs 10 turns). maxTurns is server-authoritative;
          // the flag records the requested experiment assignment.
          track('chat_start', {
            maxTurns: session.maxTurns,
            'EXP-03': getFlag('EXP-03'),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start chat');
      } finally {
        setIsLoading(false);
      }
    }
    initChat();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || status !== 'active') return;

    setInput('');
    setIsSending(true);
    setError(null);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await apiFetch<ChatSessionResponse>(
        '/api/chat/message',
        {
          method: 'POST',
          body: JSON.stringify({ content: trimmed }),
        },
      );

      setMessages(response.messages);
      setTurnCount(response.turnCount);
      setStatus(response.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const turnsLeft = maxTurns - turnCount;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading chat...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          {status === 'active' && (
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600">
              {t('turnsLeft', { count: turnsLeft })}
            </span>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4">
          <div className="mx-auto max-w-lg">
            <p className="py-2 text-center text-xs text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* Input area or completion CTA */}
      <div className="sticky bottom-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto max-w-lg">
          {status === 'completed' ? (
            <button
              onClick={() => router.push(`/${locale}/summary`)}
              className="w-full rounded-full bg-rose-500 py-3 text-center font-semibold text-white transition hover:bg-rose-600"
            >
              {t('complete')}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('placeholder')}
                disabled={isSending}
                maxLength={500}
                className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="rounded-full bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
              >
                {t('send')}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
