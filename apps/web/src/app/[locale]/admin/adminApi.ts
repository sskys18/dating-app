// Admin console talks to the API with a shared admin key (x-admin-key header),
// NOT the cookie-based session that apiFetch uses. The web has no admin login,
// so the key is held in localStorage and sent on every admin request.
//
// shortcut: bearer-style shared key in localStorage — fine for the dev/internal
// admin console. Ceiling: anyone with the key (or XSS on this page) gets full
// moderation power. Upgrade path: real admin SSO + httpOnly session cookies.

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const ADMIN_KEY_STORAGE = 'admin-api-key';

export interface ReportSnapshot {
  capturedAt?: string;
  reportedProfile?: {
    id: string;
    nickname: string | null;
    bio: string | null;
    introLine: string | null;
    photoUrls: string[];
  };
  chatRoomId?: string;
  messages?: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  }[];
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  description: string | null;
  snapshot: ReportSnapshot | null;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  reporter: { id: string; nickname: string | null } | null;
  reported: { id: string; nickname: string | null; status: string } | null;
}

export type ResolveStatus = 'reviewed' | 'resolved' | 'dismissed';

async function adminFetch<T>(
  key: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': key,
      ...options?.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized: invalid admin key');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  // PATCH returns { success: true }; callers that don't need the body ignore it.
  return res.json() as Promise<T>;
}

export function listReports(
  key: string,
  status?: string,
): Promise<AdminReport[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminFetch<AdminReport[]>(key, `/api/reports${qs}`);
}

export function resolveReport(
  key: string,
  id: string,
  status: ResolveStatus,
  banReported = false,
): Promise<{ success: boolean }> {
  return adminFetch<{ success: boolean }>(key, `/api/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, banReported }),
  });
}
