import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiClientError } from '../../src/api/client';

describe('Typed Frontend API Client & Error Contract Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps successful responses seamlessly', async () => {
    const mockResponse = {
      authenticated: true,
      user: {
        id: 'user-123',
        username: 'dev-user',
        email: 'user@example.com',
        kdfSalt: 'salt',
        kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
        encryptedVaultKey: '{}',
        hasRecoveryKey: true,
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await apiClient.auth.getMe();
    expect(data.authenticated).toBe(true);
    expect(data.user.username).toBe('dev-user');
  });

  it('unpacks structured AppError responses into typed ApiClientError', async () => {
    const errorResponse = {
      error: {
        code: 'CONFLICT',
        message: 'An account with this username already exists',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(errorResponse), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    try {
      await apiClient.auth.register({
        username: 'dev-user',
        kdfSalt: 'salt',
        kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
        authVerifier: 'proof',
        encryptedVaultKey: 'key',
        initialEncryptedVault: 'payload',
        initialIv: 'iv',
      });
      expect.unreachable('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.code).toBe('CONFLICT');
      expect(err.status).toBe(409);
      expect(err.message).toBe('An account with this username already exists');
    }
  });

  it('handles network-level disconnects gracefully with NETWORK_ERROR code', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'));

    try {
      await apiClient.vault.get();
      expect.unreachable('Should have thrown ApiClientError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.status).toBe(0);
      expect(err.message).toContain('Failed to fetch');
    }
  });
});
