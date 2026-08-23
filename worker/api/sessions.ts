/**
 * AegisVault Session & Account Management API Routes
 */

import { Hono } from 'hono';
import { Database } from '../database/db';
import { requireAuth } from '../middleware/auth';
import type { Env, Variables } from '../types';

export const sessionRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

sessionRouter.use('*', requireAuth);

// 1. List active sessions
sessionRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const currentSession = c.get('session')!;
  const db = new Database(c.env.DB);

  const sessions = await db.getSessionsByUserId(user.id);

  const formatted = sessions.map((s) => ({
    id: s.id,
    userAgent: s.user_agent,
    createdAt: s.created_at,
    lastActiveAt: s.last_active_at,
    expiresAt: s.expires_at,
    isCurrent: s.id === currentSession.id,
  }));

  return c.json({ sessions: formatted });
});

// 2. Revoke a remote session
sessionRouter.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  const db = new Database(c.env.DB);

  await db.deleteSessionByIdAndUserId(sessionId, user.id);
  return c.json({ success: true, message: 'Session revoked successfully' });
});

// 3. Delete user account & all associated encrypted data
sessionRouter.delete('/account/purge', async (c) => {
  const user = c.get('user')!;
  const db = new Database(c.env.DB);

  await db.deleteUser(user.id);

  c.header('Set-Cookie', 'aegis_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return c.json({ success: true, message: 'Account and encrypted vault permanently deleted' });
});
