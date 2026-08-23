/**
 * AegisVault Vault Synchronization & Concurrency API Routes
 */

import { Hono } from 'hono';
import { Database } from '../database/db';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';
import type { Env, Variables } from '../types';

export const vaultRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

vaultRouter.use('*', requireAuth);

// 1. Fetch active encrypted vault
vaultRouter.get('/', async (c) => {
  const user = c.get('user')!;
  const db = new Database(c.env.DB);
  const vault = await db.getVaultByUserId(user.id);

  if (!vault) {
    return c.json({ error: 'Not Found', message: 'Vault not found' }, 404);
  }

  return c.json({
    vaultId: vault.id,
    revision: vault.current_revision,
    cryptoVersion: vault.crypto_version,
    encryptedPayload: vault.encrypted_payload,
    iv: vault.iv,
    updatedAt: vault.updated_at,
  });
});

// 2. Update vault with optimistic concurrency control
vaultRouter.put('/', rateLimiter({ maxRequests: 60, windowSeconds: 60 }), async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json<{
    expectedRevision: number;
    encryptedPayload: string;
    iv: string;
  }>();

  if (
    typeof body.expectedRevision !== 'number' ||
    !body.encryptedPayload ||
    !body.iv
  ) {
    return c.json({ error: 'Validation Error', message: 'Missing required sync parameters' }, 400);
  }

  const db = new Database(c.env.DB);
  const currentVault = await db.getVaultByUserId(user.id);

  if (!currentVault) {
    return c.json({ error: 'Not Found', message: 'Vault not found' }, 404);
  }

  // Optimistic Concurrency Check
  if (currentVault.current_revision !== body.expectedRevision) {
    return c.json(
      {
        error: 'Conflict',
        message: 'Vault has been modified by another session. Please merge changes.',
        currentRevision: currentVault.current_revision,
        encryptedPayload: currentVault.encrypted_payload,
        iv: currentVault.iv,
      },
      409
    );
  }

  const now = Date.now();
  const nextRevision = currentVault.current_revision + 1;

  const success = await db.updateVault(
    currentVault,
    nextRevision,
    body.encryptedPayload,
    body.iv,
    now
  );

  if (!success) {
    return c.json(
      {
        error: 'Conflict',
        message: 'Concurrent modification detected during atomic write.',
        currentRevision: currentVault.current_revision,
      },
      409
    );
  }

  return c.json({
    success: true,
    revision: nextRevision,
    updatedAt: now,
  });
});

// 3. List historical revisions
vaultRouter.get('/revisions', async (c) => {
  const user = c.get('user')!;
  const db = new Database(c.env.DB);
  const vault = await db.getVaultByUserId(user.id);

  if (!vault) {
    return c.json({ error: 'Not Found', message: 'Vault not found' }, 404);
  }

  const revisions = await db.getVaultRevisions(vault.id);
  return c.json({ revisions });
});

// 4. Fetch specific historical revision
vaultRouter.get('/revisions/:rev', async (c) => {
  const user = c.get('user')!;
  const revNum = parseInt(c.req.param('rev'), 10);
  if (isNaN(revNum)) {
    return c.json({ error: 'Validation Error', message: 'Invalid revision number' }, 400);
  }

  const db = new Database(c.env.DB);
  const vault = await db.getVaultByUserId(user.id);

  if (!vault) {
    return c.json({ error: 'Not Found', message: 'Vault not found' }, 404);
  }

  const historical = await db.getVaultRevision(vault.id, revNum);
  if (!historical) {
    return c.json({ error: 'Not Found', message: 'Revision not found' }, 404);
  }

  return c.json({
    revision: historical.revision,
    cryptoVersion: historical.crypto_version,
    encryptedPayload: historical.encrypted_payload,
    iv: historical.iv,
    createdAt: historical.created_at,
  });
});
