'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ADMIN_KEY_STORAGE,
  listReports,
  resolveReport,
  type AdminReport,
  type ResolveStatus,
} from './adminApi';
import { ReportCard } from './ReportCard';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
] as const;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any saved key once on mount.
  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (saved) setAdminKey(saved);
    setBootstrapped(true);
  }, []);

  const load = useCallback(
    async (key: string, status: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listReports(key, status || undefined);
        setReports(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load reports';
        setError(message);
        // A bad key shouldn't trap the user — drop it and re-prompt.
        if (message.toLowerCase().includes('unauthorized')) {
          localStorage.removeItem(ADMIN_KEY_STORAGE);
          setAdminKey(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Refetch whenever the key or filter changes.
  useEffect(() => {
    if (adminKey) load(adminKey, statusFilter);
  }, [adminKey, statusFilter, load]);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(ADMIN_KEY_STORAGE, trimmed);
    setAdminKey(trimmed);
    setKeyInput('');
  };

  const handleSignOut = () => {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey(null);
    setReports([]);
  };

  const handleAction = async (
    id: string,
    status: ResolveStatus,
    banReported: boolean,
  ) => {
    if (!adminKey) return;
    await resolveReport(adminKey, id, status, banReported);
    // Refresh so status badges / ban state reflect the change.
    await load(adminKey, statusFilter);
  };

  // Avoid a key-prompt flash before localStorage is read.
  if (!bootstrapped) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    );
  }

  // ── Key prompt gate ──────────────────────────────────────────────
  if (!adminKey) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <form
          onSubmit={handleSaveKey}
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h1 className="text-xl font-bold text-gray-900">Admin console</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter the admin API key to manage reports.
          </p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin API key"
            autoFocus
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!keyInput.trim()}
            className="mt-4 w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      </main>
    );
  }

  // ── Report dashboard ─────────────────────────────────────────────
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">
            Review user reports and take moderation action.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${
              statusFilter === f.value
                ? 'bg-rose-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => adminKey && load(adminKey, statusFilter)}
          disabled={isLoading}
          className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading && reports.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">
            Loading reports...
          </p>
        )}

        {!isLoading && !error && reports.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-sm text-gray-500">No reports to show.</p>
          </div>
        )}

        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onAction={handleAction}
          />
        ))}
      </div>
    </main>
  );
}
