/**
 * Surakshit Vault Authentication & Cryptographic Context
 * Refactored to use typed apiClient and resilient error handling.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  deriveKeysFromMasterPassword,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  computeAuthVerifier,
} from '../crypto/keys';
import { generateSalt } from '../crypto/random';
import { assertSafeArgon2Params } from '../crypto/kdf-policy';
import { decryptVaultForRevision, encryptVaultForRevision } from '../crypto/vault-binding';
import { bytesToBase64, base64ToBytes, bytesToUtf8, utf8ToBytes } from '../crypto/encoding';
import { generateRecoveryPhrase, deriveRecoveryKek, wrapRecoveryVaultKey, unwrapRecoveryVaultKey } from '../crypto/recovery';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '../crypto/encoding';
import { memoryStore } from '../storage/memory-store';
import { apiClient, ApiClientError } from '../api/client';
import { logger } from '../utils/logger';
import type { AuthUser } from '../types/auth';
import type { DecryptedVault } from '../types/vault';

export interface RegisterOptions {
  username: string;
  email?: string;
  masterPass: string;
  enableRecovery?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  error: string | null;
  recoveryPhraseCreated: string | null;
  clearRecoveryPhraseModal: () => void;
  login: (identifier: string, masterPass: string) => Promise<boolean>;
  register: (
    optionsOrUsername: string | RegisterOptions,
    masterPassOrEmail?: string,
    maybeMasterPass?: string,
    maybeEnableRecovery?: boolean
  ) => Promise<{ success: boolean; recoveryPhrase?: string }>;
  addEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  unlock: (masterPass: string) => Promise<boolean>;
  lock: () => void;
  logout: () => Promise<void>;
  recoverVault: (identifier: string, recoveryPhrase: string, newMasterPass: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function computeLookupHash(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();
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
      const data = await apiClient.vault.get();
      const iv = base64ToBytes(data.iv);
      const ciphertext = base64ToBytes(data.encryptedPayload);
      // Bound to the server-reported revision; rejects rolled-back or relabelled payloads.
      const { plaintext: decryptedBytes } = await decryptVaultForRevision(ciphertext, vek, iv, data.revision, data.vaultId);
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
      const data = await apiClient.auth.getMe();
      if (data && data.user) {
        const u = data.user;
        setUser({
          id: u.id,
          username: u.username || 'User',
          email: u.email || '',
          emailLookupHash: u.email ? computeLookupHash(u.email) : '',
          usernameLookupHash: computeLookupHash(u.username || ''),
          kdfSalt: u.kdfSalt,
          kdfParams: u.kdfParams,
          encryptedVaultKey: JSON.parse(u.encryptedVaultKey),
          hasRecoveryKey: u.hasRecoveryKey,
        });
        setIsAuthenticated(true);
        setIsLocked(true); // Locked until user enters master password
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setIsLocked(true);
      }
    } catch (err) {
      setIsAuthenticated(false);
      setUser(null);
      setIsLocked(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login: accepts either Email or Username in `identifier`
  const login = async (identifier: string, masterPass: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const identifierLookupHash = computeLookupHash(identifier);

      // 1. Prelogin fetch salt via typed client
      const preData = await apiClient.auth.prelogin({
        identifierLookupHash,
        emailLookupHash: identifierLookupHash,
      });

      // 2. Client-side Key Derivation (server-supplied params are bounded to block KDF downgrade)
      const { authKey, kek } = await deriveKeysFromMasterPassword(
        masterPass,
        preData.kdfSalt,
        assertSafeArgon2Params(preData.kdfParams)
      );

      const authProof = computeAuthVerifier(authKey);

      // 3. Login verify via typed client
      const loginData = await apiClient.auth.login({
        identifierLookupHash,
        emailLookupHash: identifierLookupHash,
        authProof,
      });

      const wrappedKey = JSON.parse(loginData.user.encryptedVaultKey);

      // 4. Unwrap VEK
      const vek = await unwrapVaultKey(wrappedKey, kek);
      memoryStore.setVaultKey(vek);

      const authUser: AuthUser = {
        id: loginData.user.id,
        username: loginData.user.username || (identifier.includes('@') ? identifier.split('@')[0] : identifier),
        email: loginData.user.email || '',
        emailLookupHash: loginData.user.email ? computeLookupHash(loginData.user.email) : '',
        usernameLookupHash: computeLookupHash(loginData.user.username || identifier),
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
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Login failed');
      setError(msg);
      logger.error('Login failed', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register: supports required username and optional email
  const register = async (
    optionsOrUsername: string | RegisterOptions,
    masterPassOrEmail?: string,
    maybeMasterPass?: string,
    maybeEnableRecovery?: boolean
  ): Promise<{ success: boolean; recoveryPhrase?: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      let username = '';
      let email: string | undefined = undefined;
      let masterPass = '';
      let enableRecovery = true;

      if (typeof optionsOrUsername === 'object') {
        username = optionsOrUsername.username;
        email = optionsOrUsername.email ? optionsOrUsername.email.trim() : undefined;
        masterPass = optionsOrUsername.masterPass;
        enableRecovery = optionsOrUsername.enableRecovery ?? true;
      } else if (maybeMasterPass !== undefined) {
        username = optionsOrUsername;
        email = masterPassOrEmail ? masterPassOrEmail.trim() : undefined;
        masterPass = maybeMasterPass;
        enableRecovery = maybeEnableRecovery ?? true;
      } else {
        username = optionsOrUsername;
        masterPass = masterPassOrEmail || '';
        enableRecovery = (maybeMasterPass as unknown as boolean) ?? true;
      }

      const usernameLookupHash = computeLookupHash(username);
      const emailLookupHash = email ? computeLookupHash(email) : undefined;
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
      // Initial vault is stored by the server as revision 1.
      const { ciphertext: initialCiphertext, iv: initialIv } = await encryptVaultForRevision(initialJsonBytes, vek, 1);

      // 5. Send registration payload via typed client
      await apiClient.auth.register({
        username,
        usernameLookupHash,
        email: email || undefined,
        emailLookupHash: emailLookupHash || undefined,
        kdfSalt: saltBase64,
        kdfParams,
        authVerifier,
        encryptedVaultKey: JSON.stringify(wrappedVEK),
        encryptedRecoveryKey: wrappedRecoveryKey,
        recoverySalt: recoverySaltBase64,
        initialEncryptedVault: bytesToBase64(initialCiphertext),
        initialIv: bytesToBase64(initialIv),
      });

      if (recoveryPhrase) {
        setRecoveryPhraseCreated(recoveryPhrase);
      }

      // Automatically login with username
      const loginSuccess = await login(username, masterPass);
      return { success: loginSuccess, recoveryPhrase };
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Registration failed');
      setError(msg);
      logger.error('Registration failed', err);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  // Add/Update Email Later
  const addEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const emailLookupHash = computeLookupHash(email);
      const res = await apiClient.auth.updateEmail({ email: email.trim(), emailLookupHash });

      if (user) {
        setUser({
          ...user,
          email: res.email,
          emailLookupHash,
        });
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Failed to add email');
      return { success: false, error: msg };
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
        assertSafeArgon2Params(user.kdfParams)
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
      await apiClient.auth.logout();
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
    identifier: string,
    recoveryPhrase: string,
    _newMasterPass: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const identifierLookupHash = computeLookupHash(identifier);
      const resData = await apiClient.auth.recover({
        identifierLookupHash,
        emailLookupHash: identifierLookupHash,
      });

      const wrappedBlob = JSON.parse(resData.encryptedRecoveryKey);

      // Unwrap VEK with recovery phrase
      const vek = await unwrapRecoveryVaultKey(recoveryPhrase, wrappedBlob, resData.recoverySalt);

      memoryStore.setVaultKey(vek);
      setIsLocked(false);
      setIsAuthenticated(true);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Recovery failed');
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
        addEmail,
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
