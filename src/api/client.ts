/**
 * Surakshit Vault Typed Frontend API Client
 * Encapsulates network operations, standard error parsing, and API contracts.
 */

import type {
  PreloginRequest,
  PreloginResponse,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  UpdateEmailRequest,
  UpdateEmailResponse,
  MeResponse,
  RecoverResponse,
  VaultResponse,
  SyncVaultRequest,
  SyncVaultResponse,
  SessionsResponse,
} from '../types/api';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiClientError('NETWORK_ERROR', msg, 0);
  }

  let data: any = null;
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const code = data?.error?.code || 'HTTP_ERROR';
    const message = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const details = data?.error?.details || (data?.currentRevision !== undefined ? data : undefined);
    throw new ApiClientError(code, message, res.status, details);
  }

  return data as T;
}

export const apiClient = {
  auth: {
    async prelogin(req: PreloginRequest): Promise<PreloginResponse> {
      return request<PreloginResponse>('/api/auth/prelogin', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    },

    async register(req: RegisterRequest): Promise<RegisterResponse> {
      return request<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    },

    async login(req: LoginRequest): Promise<LoginResponse> {
      return request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    },

    async updateEmail(req: UpdateEmailRequest): Promise<UpdateEmailResponse> {
      return request<UpdateEmailResponse>('/api/auth/email', {
        method: 'PUT',
        body: JSON.stringify(req),
      });
    },

    async getMe(): Promise<MeResponse> {
      return request<MeResponse>('/api/auth/me', {
        method: 'GET',
      });
    },

    async logout(): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>('/api/auth/logout', {
        method: 'POST',
      });
    },

    async recover(req: PreloginRequest): Promise<RecoverResponse> {
      return request<RecoverResponse>('/api/auth/recover', {
        method: 'POST',
        body: JSON.stringify(req),
      });
    },
  },

  vault: {
    async get(): Promise<VaultResponse> {
      return request<VaultResponse>('/api/vault', {
        method: 'GET',
      });
    },

    async sync(req: SyncVaultRequest): Promise<SyncVaultResponse> {
      return request<SyncVaultResponse>('/api/vault', {
        method: 'PUT',
        body: JSON.stringify(req),
      });
    },

    async getRevisions(): Promise<{ revisions: Array<{ id: string; revision: number; createdAt: number }> }> {
      return request<{ revisions: Array<{ id: string; revision: number; createdAt: number }> }>('/api/vault/revisions', {
        method: 'GET',
      });
    },

    async getRevision(rev: number): Promise<VaultResponse> {
      return request<VaultResponse>(`/api/vault/revisions/${rev}`, {
        method: 'GET',
      });
    },
  },

  sessions: {
    async list(): Promise<SessionsResponse> {
      return request<SessionsResponse>('/api/sessions', {
        method: 'GET',
      });
    },

    async revoke(id: string): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>(`/api/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async purgeAccount(): Promise<{ success: boolean; message: string }> {
      return request<{ success: boolean; message: string }>('/api/sessions/account/purge', {
        method: 'DELETE',
      });
    },
  },
};
