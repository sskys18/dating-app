import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Grants access to the admin report surface via EITHER:
 *  - an `x-admin-key` header matching `process.env.ADMIN_API_KEY` (only when that
 *    env var is set and non-empty), OR
 *  - an already-authenticated user with `role === 'admin'` (composed after
 *    JwtAuthGuard, e.g. a future authenticated admin console).
 *
 * shortcut: shared static admin key — fine for the local/dev admin console while
 * the web has no login. Ceiling: any holder of the key has full moderation power
 * and there's no per-admin audit trail. Upgrade path: real admin SSO/RBAC
 * (authenticated sessions + role checks via AdminGuard), then drop the key path.
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (req.user?.role === 'admin') {
      return true;
    }

    const expected = process.env.ADMIN_API_KEY;
    const provided = req.headers['x-admin-key'];
    if (
      expected &&
      typeof provided === 'string' &&
      provided.length > 0 &&
      constantTimeEqual(provided, expected)
    ) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}

/** Length-safe constant-time string compare (avoids leaking length via early return). */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Compare against self so the work is constant-time regardless of length.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
