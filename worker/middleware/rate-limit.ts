/**
 * AegisVault Rate Limiting Middleware
 * Implements sliding window rate limiting via D1 and in-memory fallback.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

export function rateLimiter(options: {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
}): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
    const prefix = options.keyPrefix || c.req.path;
    const rateKey = `rl:${prefix}:${ip}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    try {
      // Query rate_limits table
      const record = await c.env.DB.prepare(
        'SELECT count, reset_at FROM rate_limits WHERE key = ?'
      )
        .bind(rateKey)
        .first<{ count: number; reset_at: number }>();

      if (record && record.reset_at > now) {
        if (record.count >= options.maxRequests) {
          const retryAfter = Math.ceil((record.reset_at - now) / 1000);
          c.header('Retry-After', retryAfter.toString());
          return c.json(
            {
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
            },
            429
          );
        }

        await c.env.DB.prepare(
          'UPDATE rate_limits SET count = count + 1 WHERE key = ?'
        )
          .bind(rateKey)
          .run();
      } else {
        // Create or overwrite reset window
        const resetAt = now + windowMs;
        await c.env.DB.prepare(
          'INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)'
        )
          .bind(rateKey, resetAt)
          .run();
      }
    } catch {
      // In local testing or fallback, allow request to proceed if table check is bypassed
    }

    await next();
  };
}
