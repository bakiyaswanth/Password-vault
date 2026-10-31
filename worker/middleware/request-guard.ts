/**
 * Surakshit Vault Request Guard (CSRF hardening)
 *
 * State-changing API calls must come from an allowed origin and, when they carry a body,
 * be JSON. Browsers can send `text/plain` / form bodies cross-site without a CORS preflight,
 * and Hono's c.req.json() parses them regardless of Content-Type, so without this check a
 * third-party page could e.g. log the victim's browser into an attacker account.
 */

import type { MiddlewareHandler } from 'hono';
import { AppError } from '../errors/AppError';
import type { Env } from '../types';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isAllowedOrigin(origin: string, requestUrl: string, env: Env): boolean {
  if (origin === new URL(requestUrl).origin) return true; // same origin (incl. Pages preview URLs)
  if (env.CORS_ORIGIN && env.CORS_ORIGIN !== '*' && origin === env.CORS_ORIGIN) return true;
  if (env.ENVIRONMENT !== 'production') {
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

export const requestGuard: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (UNSAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin && !isAllowedOrigin(origin, c.req.url, c.env)) {
      throw AppError.forbidden('Cross-origin request blocked');
    }

    // Bodyless calls (logout, DELETE) send no Content-Type; anything that does must be JSON.
    const contentType = c.req.header('Content-Type');
    if (contentType && !/^application\/json\s*(;|$)/i.test(contentType)) {
      throw AppError.unsupportedMediaType();
    }
  }
  await next();
};
