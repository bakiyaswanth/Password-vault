/**
 * AegisVault Authentication Middleware
 * Validates session tokens against D1 sessions table.
 */

import type { MiddlewareHandler } from 'hono';
import { Database } from '../database/db';
import type { Env, Variables } from '../types';

/**
 * Computes a SHA-256 hex string from a raw token.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extracts session token from Cookie header or Bearer authorization header.
 */
export function extractToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  // 1. Try Cookie header
  const cookieHeader = c.req.header('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)aegis_session=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // 2. Try Authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (
  c,
  next
) => {
  const token = extractToken(c);
  if (!token) {
    return c.json({ error: 'Unauthorized', message: 'Authentication session required' }, 401);
  }

  const tokenHash = await hashToken(token);
  const db = new Database(c.env.DB);
  const session = await db.getSessionByTokenHash(tokenHash);

  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Session expired or invalid' }, 401);
  }

  const user = await db.getUserById(session.user_id);
  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'User not found' }, 401);
  }

  // Update session last active time asynchronously
  c.executionCtx?.waitUntil?.(db.updateSessionActivity(session.id, Date.now()));

  c.set('user', user);
  c.set('session', session);

  await next();
};
