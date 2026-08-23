import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// In-memory dev database for seamless single-command 'npm run dev' experience
function localDevApiPlugin(): Plugin {
  const usersByIdentifier = new Map<string, any>();
  const usersById = new Map<string, any>();
  const vaults = new Map<string, any>();
  const sessions = new Map<string, any>();

  const sendError = (res: any, status: number, code: string, message: string, details?: any) => {
    res.statusCode = status;
    res.end(JSON.stringify({ error: { code, message, ...(details ? { details } : {}) } }));
  };

  return {
    name: 'local-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        // Helper to read JSON body
        const readBody = (): Promise<any> =>
          new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk) => (data += chunk));
            req.on('end', () => {
              try {
                resolve(data ? JSON.parse(data) : {});
              } catch {
                resolve({});
              }
            });
          });

        res.setHeader('Content-Type', 'application/json');

        // 1. Health check
        if (url === '/api/health' && req.method === 'GET') {
          res.end(JSON.stringify({ status: 'ok', service: 'Surakshit Vault Dev API', zeroKnowledge: true }));
          return;
        }

        // 2. Pre-login
        if (url === '/api/auth/prelogin' && req.method === 'POST') {
          const body = await readBody();
          const lookupHash = body.identifierLookupHash || body.emailLookupHash;

          if (!lookupHash) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Lookup identifier hash is required');
          }

          const user = usersByIdentifier.get(lookupHash);
          if (user) {
            res.end(JSON.stringify({ exists: true, kdfSalt: user.kdfSalt, kdfParams: user.kdfParams }));
          } else {
            res.end(
              JSON.stringify({
                exists: false,
                kdfSalt: 'ZGV2LXNhbHQtZHVtbXktYmFzZTY0LWZvci1sb2NhbC1kZXY=',
                kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'ZGV2LXNhbHQ=', keyLengthBytes: 32 },
              })
            );
          }
          return;
        }

        // 3. Register (with optional email)
        if (url === '/api/auth/register' && req.method === 'POST') {
          const body = await readBody();
          if (!body.username) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'Username is required');
          }

          const username = body.username.trim();
          const email = body.email ? body.email.trim() : '';

          if (body.usernameLookupHash && usersByIdentifier.has(body.usernameLookupHash)) {
            return sendError(res, 409, 'CONFLICT', 'An account with this username already exists');
          }

          if (body.emailLookupHash && usersByIdentifier.has(body.emailLookupHash)) {
            return sendError(res, 409, 'CONFLICT', 'An account with this email already exists');
          }

          const userId = `dev-user-${Date.now()}`;
          const vaultId = `dev-vault-${Date.now()}`;

          const newUser = {
            id: userId,
            username,
            email,
            emailLookupHash: body.emailLookupHash || '',
            usernameLookupHash: body.usernameLookupHash,
            kdfSalt: body.kdfSalt,
            kdfParams: body.kdfParams,
            authVerifier: body.authVerifier,
            encryptedVaultKey: body.encryptedVaultKey,
            encryptedRecoveryKey: body.encryptedRecoveryKey,
            recoverySalt: body.recoverySalt,
          };

          const newVault = {
            id: vaultId,
            userId,
            currentRevision: 1,
            cryptoVersion: 1,
            encryptedPayload: body.initialEncryptedVault,
            iv: body.initialIv,
            updatedAt: Date.now(),
          };

          usersById.set(userId, newUser);
          if (body.usernameLookupHash) usersByIdentifier.set(body.usernameLookupHash, newUser);
          if (body.emailLookupHash) usersByIdentifier.set(body.emailLookupHash, newUser);
          vaults.set(userId, newVault);

          res.statusCode = 201;
          res.end(JSON.stringify({
            success: true,
            message: 'User registered successfully',
            user: { id: userId, username, email }
          }));
          return;
        }

        // 4. Login
        if (url === '/api/auth/login' && req.method === 'POST') {
          const body = await readBody();
          const lookupHash = body.identifierLookupHash || body.emailLookupHash;
          const user = usersByIdentifier.get(lookupHash);

          if (!user || user.authVerifier !== body.authProof) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Invalid credentials');
          }

          const token = `dev-token-${Date.now()}`;
          sessions.set(token, user);
          res.setHeader('Set-Cookie', `aegis_session=${token}; Path=/; HttpOnly; SameSite=Strict`);
          res.end(
            JSON.stringify({
              success: true,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                kdfSalt: user.kdfSalt,
                kdfParams: user.kdfParams,
                encryptedVaultKey: user.encryptedVaultKey,
                hasRecoveryKey: !!user.encryptedRecoveryKey,
              },
              sessionToken: token,
            })
          );
          return;
        }

        // 5. Update/Add Email
        if (url === '/api/auth/email' && req.method === 'PUT') {
          const cookieHeader = req.headers['cookie'] || '';
          const match = cookieHeader.match(/aegis_session=([^;]+)/);
          const token = match ? match[1] : '';
          const user = sessions.get(token);

          if (!user) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authentication session required');
          }

          const body = await readBody();
          if (!body.email) {
            return sendError(res, 400, 'VALIDATION_ERROR', 'A valid non-empty email address is required');
          }

          if (body.emailLookupHash) {
            const existing = usersByIdentifier.get(body.emailLookupHash);
            if (existing && existing.id !== user.id) {
              return sendError(res, 409, 'CONFLICT', 'This email address is already associated with another account');
            }
          }

          user.email = body.email.trim();
          user.emailLookupHash = body.emailLookupHash;
          if (body.emailLookupHash) usersByIdentifier.set(body.emailLookupHash, user);

          res.end(JSON.stringify({ success: true, email: user.email, message: 'Email address added and verified successfully' }));
          return;
        }

        // 6. Check Session /me
        if (url === '/api/auth/me' && req.method === 'GET') {
          const cookieHeader = req.headers['cookie'] || '';
          const match = cookieHeader.match(/aegis_session=([^;]+)/);
          const token = match ? match[1] : '';
          const user = sessions.get(token);

          if (!user) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Session expired or invalid');
          }

          res.end(
            JSON.stringify({
              authenticated: true,
              user: {
                id: user.id,
                username: user.username,
                email: user.email,
                kdfSalt: user.kdfSalt,
                kdfParams: user.kdfParams,
                encryptedVaultKey: user.encryptedVaultKey,
                hasRecoveryKey: !!user.encryptedRecoveryKey,
              },
            })
          );
          return;
        }

        // 7. Get Vault
        if (url === '/api/vault' && req.method === 'GET') {
          const cookieHeader = req.headers['cookie'] || '';
          const match = cookieHeader.match(/aegis_session=([^;]+)/);
          const token = match ? match[1] : '';
          const user = sessions.get(token);

          if (!user) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authentication session required');
          }

          const vault = vaults.get(user.id);
          if (!vault) {
            return sendError(res, 404, 'NOT_FOUND', 'Vault not found');
          }

          res.end(
            JSON.stringify({
              vaultId: vault.id,
              revision: vault.currentRevision,
              cryptoVersion: vault.cryptoVersion,
              encryptedPayload: vault.encryptedPayload,
              iv: vault.iv,
              updatedAt: vault.updatedAt,
            })
          );
          return;
        }

        // 8. Sync/Update Vault
        if (url === '/api/vault' && req.method === 'PUT') {
          const cookieHeader = req.headers['cookie'] || '';
          const match = cookieHeader.match(/aegis_session=([^;]+)/);
          const token = match ? match[1] : '';
          const user = sessions.get(token);

          if (!user) {
            return sendError(res, 401, 'UNAUTHORIZED', 'Authentication session required');
          }

          const body = await readBody();
          const vault = vaults.get(user.id);
          if (vault && vault.currentRevision !== body.expectedRevision) {
            return sendError(
              res,
              409,
              'CONFLICT',
              'Vault has been modified by another session. Please merge changes.',
              {
                currentRevision: vault.currentRevision,
                encryptedPayload: vault.encryptedPayload,
                iv: vault.iv,
              }
            );
          }

          const nextRev = (vault ? vault.currentRevision : 0) + 1;
          const updatedVault = {
            id: vault?.id || `dev-vault-${Date.now()}`,
            userId: user.id,
            currentRevision: nextRev,
            cryptoVersion: 1,
            encryptedPayload: body.encryptedPayload,
            iv: body.iv,
            updatedAt: Date.now(),
          };

          vaults.set(user.id, updatedVault);
          res.end(JSON.stringify({ success: true, revision: nextRev, updatedAt: Date.now() }));
          return;
        }

        // 9. Logout
        if (url === '/api/auth/logout' && req.method === 'POST') {
          res.setHeader('Set-Cookie', 'aegis_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
          res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
          return;
        }

        // 10. Sessions
        if (url === '/api/sessions' && req.method === 'GET') {
          res.end(
            JSON.stringify({
              sessions: [
                {
                  id: 'local-dev-session',
                  userAgent: req.headers['user-agent'] || 'Local Browser Client',
                  isCurrent: true,
                  createdAt: Date.now(),
                  lastActiveAt: Date.now(),
                  expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
                },
              ],
            })
          );
          return;
        }

        // 11. Recovery Fetch
        if (url === '/api/auth/recover' && req.method === 'POST') {
          const body = await readBody();
          const lookupHash = body.identifierLookupHash || body.emailLookupHash;
          const user = usersByIdentifier.get(lookupHash);
          if (!user || !user.encryptedRecoveryKey) {
            return sendError(res, 404, 'NOT_FOUND', 'No recovery key registered for this account');
          }
          res.end(JSON.stringify({ encryptedRecoveryKey: user.encryptedRecoveryKey, recoverySalt: user.recoverySalt }));
          return;
        }

        return next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), localDevApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          crypto: ['@noble/hashes', 'hash-wasm'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
