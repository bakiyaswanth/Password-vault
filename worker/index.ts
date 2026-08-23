/**
 * AegisVault Cloudflare Worker Entry Point
 * API Gateway, Router, Middleware, and Zero-Knowledge Request Handlers
 */

import { Hono } from 'hono';
import { securityHeaders } from './middleware/security-headers';
import { corsMiddleware } from './middleware/cors';
import { authRouter } from './api/auth';
import { vaultRouter } from './api/vault';
import { sessionRouter } from './api/sessions';
import type { Env, Variables } from './types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global Middleware
app.use('*', securityHeaders);
app.use('*', corsMiddleware);

// Safe Global Error Handler (Never leaks internals or sensitive data)
app.onError((err, c) => {
  // Safe console log without body/parameters
  console.error(`[Worker Error] ${c.req.method} ${c.req.path}:`, err.name);
  return c.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected security-monitored error occurred.',
    },
    500
  );
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'AegisVault API',
    version: '1.0.0',
    zeroKnowledge: true,
  });
});

// Mount Sub-routers
app.route('/api/auth', authRouter);
app.route('/api/vault', vaultRouter);
app.route('/api/sessions', sessionRouter);

export default app;
