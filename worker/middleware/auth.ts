/**
 * Surakshit Vault Authentication Middleware
 * Validates session tokens against D1 sessions table.
 */

import type { MiddlewareHandler } from 'hono';
import { SessionRepository } from '../repositories/SessionRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AppError } from '../errors/AppError';
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
    throw AppError.unauthorized('Authentication session required');
  }

  const tokenHash = await hashToken(token);
  const sessionRepo = new SessionRepository(c.env.DB);
  const session = await sessionRepo.findByTokenHash(tokenHash);

  if (!session) {
    throw AppError.unauthorized('Session expired or invalid');
  }

  const userRepo = new UserRepository(c.env.DB);
  const user = await userRepo.findById(session.user_id);
  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  // Update session last active time asynchronously if execution context exists
  try {
    const ctx = (c as any).executionCtx;
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(sessionRepo.updateLastActive(session.id, Date.now()));
    }
  } catch {
    // Ignore in non-Worker test contexts
  }

  c.set('user', user);
  c.set('session', session);

  await next();
};
