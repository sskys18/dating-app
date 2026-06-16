'use client';

import { useState } from 'react';
import type { AdminReport, ResolveStatus } from './adminApi';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  reviewed: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-200 text-gray-700',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] || 'bg-gray-200 text-gray-700';
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export interface ReportCardProps {
  report: AdminReport;
  /** Resolves with the action; rejects to surface an error. */
  onAction: (
    id: string,
    status: ResolveStatus,
    banReported: boolean,
  ) => Promise<void>;
}

export function ReportCard({ report, onAction }: ReportCardProps) {
  const [pending, setPending] = useState<ResolveStatus | 'ban' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = report.snapshot;
  const profile = snapshot?.reportedProfile;
  const messages = snapshot?.messages ?? [];
  const isClosed = report.status === 'resolved' || report.status === 'dismissed';

  const run = async (
    label: ResolveStatus | 'ban',
    status: ResolveStatus,
    banReported: boolean,
  ) => {
    setPending(label);
    setError(null);
    try {
      await onAction(report.id, status, banReported);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-sm font-semibold text-rose-700">
              {report.reason}
            </span>
            <StatusBadge status={report.status} />
            {report.reported?.status === 'banned' && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold uppercase text-white">
                banned
              </span>
            )}
          </div>
          {report.description && (
            <p className="mt-2 max-w-prose text-sm text-gray-700">
              {report.description}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-gray-400">
          <div>Reported {formatDate(report.createdAt)}</div>
          <div className="mt-0.5 font-mono">#{report.id}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase text-gray-400">
            Reporter
          </div>
          <div className="mt-1 text-gray-800">
            {report.reporter?.nickname || 'Unknown'}
          </div>
          <div className="font-mono text-xs text-gray-400">
            {report.reporterId}
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase text-gray-400">
            Reported user
          </div>
          <div className="mt-1 text-gray-800">
            {report.reported?.nickname || 'Unknown'}
          </div>
          <div className="font-mono text-xs text-gray-400">
            {report.reportedId}
          </div>
        </div>
      </div>

      {/* Evidence snapshot captured at report time. */}
      <details className="mt-4 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-700">
          Evidence snapshot
          {snapshot?.capturedAt
            ? ` · captured ${formatDate(snapshot.capturedAt)}`
            : ''}
        </summary>

        {!snapshot && (
          <p className="mt-3 text-sm text-gray-500">
            No snapshot was captured for this report.
          </p>
        )}

        {profile && (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase text-gray-400">
              Profile at report time
            </div>
            <div className="mt-1 text-sm text-gray-800">
              <div>
                <span className="text-gray-500">Nickname: </span>
                {profile.nickname || '—'}
              </div>
              {profile.introLine && (
                <div>
                  <span className="text-gray-500">Intro: </span>
                  {profile.introLine}
                </div>
              )}
              {profile.bio && (
                <div className="mt-1 whitespace-pre-wrap">
                  <span className="text-gray-500">Bio: </span>
                  {profile.bio}
                </div>
              )}
            </div>
            {profile.photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.photoUrls.map((url) => (
                  // Plain <img>: admin-only thumbnails of arbitrary S3 URLs;
                  // avoids next/image remotePatterns config for an internal view.
                  <img
                    key={url}
                    src={url}
                    alt="Reported profile photo"
                    className="h-20 w-20 rounded-md object-cover ring-1 ring-gray-200"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {messages.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase text-gray-400">
              Conversation ({messages.length} messages)
            </div>
            <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto rounded-md bg-white p-3 ring-1 ring-gray-100">
              {messages.map((m) => {
                const fromReported = m.senderId === report.reportedId;
                return (
                  <div key={m.id} className="text-sm">
                    <span
                      className={
                        fromReported
                          ? 'font-semibold text-rose-700'
                          : 'font-semibold text-gray-500'
                      }
                    >
                      {fromReported ? 'Reported' : 'Reporter'}:
                    </span>{' '}
                    <span className="text-gray-800">{m.content}</span>
                    <span className="ml-2 text-xs text-gray-300">
                      {formatDate(m.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </details>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run('resolved', 'resolved', false)}
          disabled={pending !== null || isClosed}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'resolved' ? '...' : 'Resolve'}
        </button>
        <button
          type="button"
          onClick={() => run('dismissed', 'dismissed', false)}
          disabled={pending !== null || isClosed}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'dismissed' ? '...' : 'Dismiss'}
        </button>
        <button
          type="button"
          onClick={() => run('ban', 'resolved', true)}
          disabled={pending !== null || report.reported?.status === 'banned'}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'ban' ? '...' : 'Ban user'}
        </button>
      </div>
    </div>
  );
}
