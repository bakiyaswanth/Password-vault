/**
 * Surakshit Vault Authentication API Controller
 */

import { Hono } from 'hono';
import { AuthService } from '../services/AuthService';
import { requireAuth, extractToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';
import { requireSecret } from '../services/verifier';
import {
  validatePrelogin,
  validateRegistration,
  validateLogin,
  validateUpdateEmail,
} from '../validation/auth';
import type { Env, Variables } from '../types';

export const authRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function secretsFrom(env: Env) {
  return { verifierKey: requireSecret(env, 'VERIFIER_KEY'), serverPepper: requireSecret(env, 'SERVER_PEPPER') };
}

// 1. Pre-login: Fetch KDF salt and parameters
authRouter.post('/prelogin', rateLimiter({ maxRequests: 20, windowSeconds: 60 }), async (c) => {
  const body = await c.req.json();
  const lookupHash = validatePrelogin(body);

  const authService = new AuthService(c.env.DB, secretsFrom(c.env));
  const result = await authService.getPrelogin(lookupHash);

  return c.json(result);
});

// 2. Register new account with required username and optional email
authRouter.post('/register', rateLimiter({ maxRequests: 10, windowSeconds: 300 }), async (c) => {
  const body = await c.req.json();
  const dto = validateRegistration(body);

  const authService = new AuthService(c.env.DB, secretsFrom(c.env));
  const result = await authService.register(dto);

  return c.json(result, 201);
});

// 3. Login with Email or Username
authRouter.post('/login', rateLimiter({ maxRequests: 10, windowSeconds: 60 }), async (c) => {
  const body = await c.req.json();
  const dto = validateLogin(body);

  const isProd = c.env.ENVIRONMENT === 'production';
  const userAgent = c.req.header('User-Agent') || null;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';

  const authService = new AuthService(c.env.DB, secretsFrom(c.env));
  const { cookieHeader, response } = await authService.login(dto, { userAgent, ip, isProd });

  c.header('Set-Cookie', cookieHeader);
  return c.json(response);
});

// 4. Update/Add Email Later
authRouter.put('/email', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();
  const dto = validateUpdateEmail(body);

  const authService = new AuthService(c.env.DB);
  const result = await authService.updateEmail(user, dto);

  return c.json(result);
});

// 5. Logout
authRouter.post('/logout', async (c) => {
  const token = extractToken(c);
  const authService = new AuthService(c.env.DB);
  const { cookieHeader, response } = await authService.logout(token);

  c.header('Set-Cookie', cookieHeader);
  return c.json(response);
});

// 6. Check session status
authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const authService = new AuthService(c.env.DB);
  return c.json(authService.getMe(user));
});

// 7. Recovery Material Fetch
authRouter.post('/recover', rateLimiter({ maxRequests: 5, windowSeconds: 300 }), async (c) => {
  const body = await c.req.json();
  const lookupHash = validatePrelogin(body);

  const authService = new AuthService(c.env.DB);
  const result = await authService.recover(lookupHash);

  return c.json(result);
});
