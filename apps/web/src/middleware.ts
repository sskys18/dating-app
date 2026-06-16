import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// Handles locale negotiation + redirects non-localized paths (e.g. `/`) to the
// default locale. Required for the next-intl App Router setup.
export default createMiddleware(routing);

export const config = {
  // Match everything except Next internals and static files.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
