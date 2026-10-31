/**
 * Surakshit Vault Cloudflare Worker Entry Point
 * API Gateway, Router, Middleware, and Centralized Error Handling
 */

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { securityHeaders } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { requestGuard } from './middleware/request-guard';
import { AppError } from './errors/AppError';
import { authRouter } from './api/auth';
import { vaultRouter } from './api/vault';
import { sessionRouter } from './api/sessions';
import type { Env, Variables } from './types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global Middleware
app.use('*', securityHeaders);
app.use('*', corsMiddleware);
app.use('/api/*', requestGuard);
// Cap request bodies before JSON parsing (a full vault sync is well under this).
app.use(
  '/api/*',
  bodyLimit({
    maxSize: 2 * 1024 * 1024,
    onError: () => {
      throw AppError.payloadTooLarge();
    },
  })
);

// Safe Centralized Global Error Handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toResponseObject(), err.status as any);
  }

  // Safe server logging without leaking secrets/passwords
  console.error(`[Worker Unhandled Error] ${c.req.method} ${c.req.path}:`, err.message || err.name);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred. Please try again.',
      },
    },
    500
  );
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Surakshit Vault API',
    version: '1.0.0',
    zeroKnowledge: true,
  });
});

// Mount Sub-routers
app.route('/api/auth', authRouter);
app.route('/api/vault', vaultRouter);
app.route('/api/sessions', sessionRouter);

export default app;
