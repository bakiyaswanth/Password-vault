/**
 * Surakshit Vault CORS Middleware
 * Reflects only the app's own origin, the configured CORS_ORIGIN, and (outside production)
 * localhost dev servers. Arbitrary *.pages.dev sites are no longer trusted with credentials.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';
import { isAllowedOrigin } from './request-guard';

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  const isAllowed = !!origin && isAllowedOrigin(origin, c.req.url, c.env);

  if (c.req.method === 'OPTIONS') {
    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Max-Age', '86400');
      c.header('Vary', 'Origin');
    }
    return c.body(null, 204);
  }

  await next();

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  }
};
