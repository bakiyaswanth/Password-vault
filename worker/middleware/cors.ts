/**
 * Surakshit Vault CORS Middleware
 * Allows Cloudflare Pages, configured origins, and local development
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin');
  const configuredOrigin = c.env.CORS_ORIGIN;

  const isAllowed =
    !origin || // Same-origin request
    configuredOrigin === '*' ||
    origin === configuredOrigin ||
    origin.endsWith('.pages.dev') ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:');

  if (c.req.method === 'OPTIONS') {
    if (isAllowed && origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Max-Age', '86400');
    }
    return c.body(null, 204);
  }

  await next();

  if (isAllowed && origin) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
};
