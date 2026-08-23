/**
 * Surakshit Vault Session & Account Management API Controller
 */

import { Hono } from 'hono';
import { SessionService } from '../services/SessionService';
import { requireAuth } from '../middleware/auth';
import type { Env, Variables } from '../types';

export const sessionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

sessionRouter.use('*', requireAuth);

// 1. List active sessions
sessionRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const currentSession = c.get('session')!;
  const sessionService = new SessionService(c.env.DB);
  const result = await sessionService.listSessions(user.id, currentSession.id);
  return c.json(result);
});

// 2. Revoke a remote session
sessionRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  const sessionService = new SessionService(c.env.DB);
  const result = await sessionService.revokeSession(user.id, sessionId);
  return c.json(result);
});

// 3. Delete user account & all associated encrypted data
sessionRouter.delete('/account/purge', async (c) => {
  const user = c.get('user')!;
  const sessionService = new SessionService(c.env.DB);
  const { cookieHeader, response } = await sessionService.purgeAccount(user.id);

  c.header('Set-Cookie', cookieHeader);
  return c.json(response);
});
