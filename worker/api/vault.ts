/**
 * Surakshit Vault Vault Synchronization & Concurrency API Controller
 */

import { Hono } from 'hono';
import { VaultService } from '../services/VaultService';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';
import { validateSyncVault, validateRevisionNumber } from '../validation/vault';
import type { Env, Variables } from '../types';

export const vaultRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

vaultRouter.use('*', requireAuth);

// 1. Fetch active encrypted vault
vaultRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const vaultService = new VaultService(c.env.DB);
  const result = await vaultService.getVault(user.id);
  return c.json(result);
});

// 2. Update vault with optimistic concurrency control
vaultRouter.put('/', rateLimiter({ maxRequests: 60, windowSeconds: 60 }), async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();
  const dto = validateSyncVault(body);

  const vaultService = new VaultService(c.env.DB);
  const result = await vaultService.syncVault(user.id, dto);

  return c.json(result);
});

// 3. List historical revisions
vaultRouter.get('/revisions', async (c) => {
  const user = c.get('user')!;
  const vaultService = new VaultService(c.env.DB);
  const result = await vaultService.listRevisions(user.id);
  return c.json(result);
});

// 4. Fetch specific historical revision
vaultRouter.get('/revisions/:rev', async (c) => {
  const user = c.get('user')!;
  const revNum = validateRevisionNumber(c.req.param('rev'));

  const vaultService = new VaultService(c.env.DB);
  const result = await vaultService.getRevision(user.id, revNum);

  return c.json(result);
});
