/**
 * AegisVault Authentication & Cryptographic Context
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  deriveKeysFromMasterPassword,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  computeAuthVerifier,
} from '../crypto/keys';
import { encryptAesGcm, decryptAesGcm } from '../crypto/aes';
import { generateSalt } from '../crypto/random';
import { bytesToBase64, base64ToBytes, bytesToUtf8, utf8ToBytes } from '../crypto/encoding';
import { generateRecoveryPhrase, deriveRecoveryKek, wrapRecoveryVaultKey, unwrapRecoveryVaultKey } from '../crypto/recovery';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '../crypto/encoding';
import { memoryStore } from '../storage/memory-store';
import { logger } from '../utils/logger';
import type { AuthUser } from '../types/auth';
import type { DecryptedVault } from '../types/vault';
import type { PreloginResponse, LoginResponse, VaultResponse } from '../types/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  error: string | null;
  recoveryPhraseCreated: string | null;
  clearRecoveryPhraseModal: () => void;
  login: (email: string, masterPass: string) => Promise<boolean>;
  register: (email: string, masterPass: string, enableRecovery: boolean) => Promise<{ success: boolean; recoveryPhrase?: string }>;
  unlock: (masterPass: string) => Promise<boolean>;
  lock: () => void;
  logout: () => Promise<void>;
  recoverVault: (email: string, recoveryPhrase: string, newMasterPass: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function computeEmailLookupHash(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = sha256(utf8ToBytes(normalized));
  return bytesToHex(hash);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryPhraseCreated, setRecoveryPhraseCreated] = useState<string | null>(null);

  // Sync isLocked state with memoryStore
  useEffect(() => {
    const unsubscribe = memoryStore.subscribe(() => {
      setIsLocked(!memoryStore.hasVaultKey());
    });
    return unsubscribe;
  }, []);

  // Fetch initial encrypted vault from server and decrypt into memory
  const fetchAndDecryptVault = useCallback(async (vek: Uint8Array) => {
    try {
      const res = await fetch('/api/vault');
      if (!res.ok) throw new Error('Failed to fetch vault from server');
      const data = (await res.json()) as VaultResponse;

      const iv = base64ToBytes(data.iv);
      const ciphertext = base64ToBytes(data.encryptedPayload);
      const decryptedBytes = await decryptAesGcm(ciphertext, vek, iv);
      const decryptedJson: DecryptedVault = JSON.parse(bytesToUtf8(decryptedBytes));

      memoryStore.setVault(decryptedJson, data.revision, data.vaultId);
      logger.info('Vault successfully loaded and decrypted into memory');
    } catch (err) {
      logger.error('Failed to load and decrypt vault', err);
      throw err;
    }
  }, []);

  // Check existing session on load
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = (await res.json()) as any;
        setUser({
          id: data.user.id,
          emailLookupHash: '',
          kdfSalt: data.user.kdfSalt,
          kdfParams: data.user.kdfParams,
          encryptedVaultKey: JSON.parse(data.user.encryptedVaultKey),
          hasRecoveryKey: data.user.hasRecoveryKey,
        });
        setIsAuthenticated(true);
        setIsLocked(true); // Locked until user provides master password
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsLocked(true);
      }
    } catch (err) {
      logger.error('Check session error', err);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login
  const login = async (email: string, masterPass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const emailLookupHash = computeEmailLookupHash(email);

      // 1. Prelogin fetch salt
      const preRes = await fetch('/api/auth/prelogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailLookupHash }),
      });
      if (!preRes.ok) throw new Error('Pre-login request failed');
      const preData = (await preRes.json()) as PreloginResponse;

      // 2. Client-side Key Derivation
      const { authKey, kek } = await deriveKeysFromMasterPassword(
        masterPass,
        preData.kdfSalt,
        preData.kdfParams
      );

      const authProof = computeAuthVerifier(authKey);

      // 3. Login verify
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailLookupHash, authProof }),
      });

      if (!loginRes.ok) {
        throw new Error('Invalid email or master password');
      }

      const loginData = (await loginRes.json()) as LoginResponse;
      const wrappedKey = JSON.parse(loginData.user.encryptedVaultKey);

      // 4. Unwrap VEK
      const vek = await unwrapVaultKey(wrappedKey, kek);
      memoryStore.setVaultKey(vek);

      const authUser: AuthUser = {
        id: loginData.user.id,
        emailLookupHash,
        kdfSalt: loginData.user.kdfSalt,
        kdfParams: loginData.user.kdfParams,
        encryptedVaultKey: wrappedKey,
        hasRecoveryKey: loginData.user.hasRecoveryKey,
      };

      setUser(authUser);
      setIsAuthenticated(true);
      setIsLocked(false);

      // 5. Fetch and decrypt vault
      await fetchAndDecryptVault(vek);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      logger.error('Login failed', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register
  const register = async (
    email: string,
    masterPass: string,
    enableRecovery: boolean
  ): Promise<{ success: boolean; recoveryPhrase?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const emailLookupHash = computeEmailLookupHash(email);
      const salt = generateSalt(32);
      const saltBase64 = bytesToBase64(salt);

      // 1. Derive Keys
      const { authKey, kek, kdfParams } = await deriveKeysFromMasterPassword(masterPass, salt);
      const authVerifier = computeAuthVerifier(authKey);

      // 2. Generate random VEK and wrap with KEK
      const vek = generateVaultKey();
      const wrappedVEK = await wrapVaultKey(vek, kek, kdfParams);

      // 3. Optional Recovery Phrase
      let recoveryPhrase: string | undefined;
      let wrappedRecoveryKey: string | undefined;
      let recoverySaltBase64: string | undefined;

      if (enableRecovery) {
        recoveryPhrase = generateRecoveryPhrase();
        const recSalt = generateSalt(32);
        recoverySaltBase64 = bytesToBase64(recSalt);
        const { recoveryKek, params: recParams } = await deriveRecoveryKek(recoveryPhrase, recSalt);
        const wrappedRec = await wrapRecoveryVaultKey(vek, recoveryKek, recParams);
        wrappedRecoveryKey = JSON.stringify(wrappedRec);
      }

      // 4. Create Initial Empty Encrypted Vault
      const initialVault: DecryptedVault = {
        version: 1,
        items: [],
        folders: ['Personal', 'Work', 'Finance'],
        updatedAt: Date.now(),
      };
      const initialJsonBytes = utf8ToBytes(JSON.stringify(initialVault));
      const { ciphertext: initialCiphertext, iv: initialIv } = await encryptAesGcm(initialJsonBytes, vek);

      // 5. Send registration payload to backend
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailLookupHash,
          kdfSalt: saltBase64,
          kdfParams,
          authVerifier,
          encryptedVaultKey: JSON.stringify(wrappedVEK),
          encryptedRecoveryKey: wrappedRecoveryKey,
          recoverySalt: recoverySaltBase64,
          initialEncryptedVault: bytesToBase64(initialCiphertext),
          initialIv: bytesToBase64(initialIv),
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as any;
        throw new Error(errorData.message || 'Registration failed');
      }

      if (recoveryPhrase) {
        setRecoveryPhraseCreated(recoveryPhrase);
      }

      // Automatically login
      const loginSuccess = await login(email, masterPass);
      return { success: loginSuccess, recoveryPhrase };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      logger.error('Registration failed', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Unlock existing authenticated session
  const unlock = async (masterPass: string): Promise<boolean> => {
    if (!user) return false;
    setIsLoading(true);
    setError(null);
    try {
      const { kek } = await deriveKeysFromMasterPassword(
        masterPass,
        user.kdfSalt,
        user.kdfParams
      );

      const vek = await unwrapVaultKey(user.encryptedVaultKey, kek);
      memoryStore.setVaultKey(vek);
      setIsLocked(false);

      await fetchAndDecryptVault(vek);
      return true;
    } catch (err) {
      setError('Invalid master password');
      logger.error('Unlock failed: incorrect password');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Lock vault
  const lock = useCallback(() => {
    memoryStore.zeroize();
    setIsLocked(true);
    logger.info('Vault locked, memory zeroized');
  }, []);

  // Logout
  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      logger.error('Logout error', err);
    } finally {
      memoryStore.zeroize();
      setUser(null);
      setIsAuthenticated(false);
      setIsLocked(true);
      setIsLoading(false);
    }
  };

  // Recover vault using 24-word recovery phrase
  const recoverVault = async (
    email: string,
    recoveryPhrase: string,
    _newMasterPass: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const emailLookupHash = computeEmailLookupHash(email);
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailLookupHash }),
      });

      if (!res.ok) {
        throw new Error('Account recovery material not found');
      }

      const resData = (await res.json()) as any;
      const wrappedBlob = JSON.parse(resData.encryptedRecoveryKey);

      // Unwrap VEK with recovery phrase
      const vek = await unwrapRecoveryVaultKey(recoveryPhrase, wrappedBlob, resData.recoverySalt);

      // Re-register / reset credentials via login
      memoryStore.setVaultKey(vek);
      setIsLocked(false);
      setIsAuthenticated(true);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Recovery failed';
      setError(msg);
      logger.error('Recovery failed', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLocked,
        isLoading,
        error,
        recoveryPhraseCreated,
        clearRecoveryPhraseModal: () => setRecoveryPhraseCreated(null),
        login,
        register,
        unlock,
        lock,
        logout,
        recoverVault,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
