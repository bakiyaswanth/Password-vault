/**
 * In-memory D1 stand-in for worker integration tests.
 * Statements are matched by SQL substring (like the original inline mock) but
 * writes are applied for both `.run()` and `db.batch()`, so services that rely on
 * batched writes (registration, vault sync, revision pruning) behave realistically.
 */

type Row = Record<string, any>;

interface Bound {
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export class MockD1Database {
  users = new Map<string, Row>();
  vaults = new Map<string, Row>();
  revisions: Row[] = [];
  sessions = new Map<string, Row>(); // keyed by token_hash
  rateLimits = new Map<string, Row>();

  prepare(query: string) {
    const self = this;
    return {
      bind(...params: any[]): Bound {
        return {
          first: async <T>() => (self.select(query, params)[0] ?? null) as T | null,
          all: async <T>() => ({ results: self.select(query, params) as T[] }),
          run: async () => ({ meta: { changes: self.write(query, params) } }),
        };
      },
    };
  }

  async batch(statements: Bound[]) {
    const out = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }

  injectUser(user: Row, vault?: Row) {
    this.users.set(user.id, user);
    if (vault) this.vaults.set(vault.id, vault);
  }

  injectSession(session: Row) {
    this.sessions.set(session.token_hash, session);
  }

  private select(q: string, p: any[]): Row[] {
    const users = [...this.users.values()];
    if (q.includes('FROM users WHERE email_lookup_hash = ? OR username_lookup_hash = ?')) {
      const rows = users.filter((u) => u.email_lookup_hash === p[0] || u.username_lookup_hash === p[1]);
      const limit = /LIMIT (\d+)/.exec(q);
      return limit ? rows.slice(0, Number(limit[1])) : rows;
    }
    if (q.includes('FROM users WHERE email_lookup_hash = ?')) return users.filter((u) => u.email_lookup_hash === p[0]);
    if (q.includes('FROM users WHERE username_lookup_hash = ?')) return users.filter((u) => u.username_lookup_hash === p[0]);
    if (q.includes('FROM users WHERE LOWER(username) = LOWER(?)')) {
      return users.filter((u) => (u.username || '').toLowerCase() === String(p[0]).toLowerCase());
    }
    if (q.includes('FROM users WHERE id = ?')) return users.filter((u) => u.id === p[0]);
    if (q.includes('FROM vaults WHERE user_id = ?')) return [...this.vaults.values()].filter((v) => v.user_id === p[0]);
    if (q.includes('FROM sessions WHERE token_hash = ?')) {
      const s = this.sessions.get(p[0]);
      return s && s.expires_at > p[1] ? [s] : [];
    }
    if (q.includes('FROM sessions WHERE user_id = ?')) return [...this.sessions.values()].filter((s) => s.user_id === p[0]);
    if (q.includes('FROM rate_limits WHERE key = ?')) {
      const r = this.rateLimits.get(p[0]);
      return r ? [r] : [];
    }
    if (q.includes('FROM vault_revisions WHERE vault_id = ? AND revision = ?')) {
      return this.revisions.filter((r) => r.vault_id === p[0] && r.revision === p[1]);
    }
    if (q.includes('FROM vault_revisions WHERE vault_id = ?')) {
      return this.revisions.filter((r) => r.vault_id === p[0]).sort((a, b) => b.revision - a.revision);
    }
    return [];
  }

  private write(q: string, p: any[]): number {
    if (q.includes('INSERT INTO users')) {
      const [id, username, email, email_lookup_hash, username_lookup_hash, kdf_salt, kdf_params, auth_verifier,
        encrypted_vault_key, encrypted_recovery_key, recovery_salt, created_at, updated_at] = p;
      this.users.set(id, { id, username, email, email_lookup_hash, username_lookup_hash, kdf_salt, kdf_params, auth_verifier,
        encrypted_vault_key, encrypted_recovery_key, recovery_salt, created_at, updated_at });
      return 1;
    }
    if (q.includes('INSERT INTO vaults')) {
      const [id, user_id, current_revision, crypto_version, encrypted_payload, iv, updated_at] = p;
      this.vaults.set(id, { id, user_id, current_revision, crypto_version, encrypted_payload, iv, updated_at });
      return 1;
    }
    if (q.includes('UPDATE users SET auth_verifier = ?')) {
      const u = this.users.get(p[2]);
      if (!u || u.auth_verifier !== p[3]) return 0;
      u.auth_verifier = p[0];
      u.updated_at = p[1];
      return 1;
    }
    if (q.includes('UPDATE users SET email = ?, email_lookup_hash = ?')) {
      const u = this.users.get(p[3]);
      if (!u) return 0;
      Object.assign(u, { email: p[0], email_lookup_hash: p[1], updated_at: p[2] });
      return 1;
    }
    if (q.includes('INSERT INTO vault_revisions')) {
      const [id, vault_id, user_id, revision, crypto_version, encrypted_payload, iv, created_at] = p;
      this.revisions.push({ id, vault_id, user_id, revision, crypto_version, encrypted_payload, iv, created_at });
      return 1;
    }
    if (q.includes('UPDATE vaults')) {
      const [rev, payload, iv, now, id, expected] = p;
      const v = this.vaults.get(id);
      if (!v || v.current_revision !== expected) return 0;
      Object.assign(v, { current_revision: rev, encrypted_payload: payload, iv, updated_at: now });
      return 1;
    }
    if (q.includes('DELETE FROM vault_revisions WHERE vault_id = ? AND revision <= ?')) {
      const before = this.revisions.length;
      this.revisions = this.revisions.filter((r) => !(r.vault_id === p[0] && r.revision <= p[1]));
      return before - this.revisions.length;
    }
    if (q.includes('INSERT INTO sessions')) {
      const [id, user_id, token_hash, user_agent, ip_hash, expires_at, created_at, last_active_at] = p;
      this.sessions.set(token_hash, { id, user_id, token_hash, user_agent, ip_hash, expires_at, created_at, last_active_at });
      return 1;
    }
    if (q.includes('DELETE FROM sessions WHERE token_hash = ?')) return this.sessions.delete(p[0]) ? 1 : 0;
    if (q.includes('DELETE FROM sessions WHERE id = ?')) {
      let n = 0;
      for (const [k, s] of this.sessions) {
        if (s.id === p[0] && (p.length < 2 || s.user_id === p[1])) {
          this.sessions.delete(k);
          n++;
        }
      }
      return n;
    }
    if (q.includes('DELETE FROM users WHERE id = ?')) {
      if (!this.users.delete(p[0])) return 0;
      for (const [k, v] of this.vaults) if (v.user_id === p[0]) this.vaults.delete(k);
      return 1;
    }
    if (q.includes('INSERT OR REPLACE INTO rate_limits')) {
      this.rateLimits.set(p[0], { count: p[1], reset_at: p[2] });
      return 1;
    }
    if (q.includes('UPDATE rate_limits SET count = count + 1')) {
      const r = this.rateLimits.get(p[0]);
      if (r) r.count += 1;
      return r ? 1 : 0;
    }
    if (q.includes('UPDATE sessions SET last_active_at')) return 1;
    return 0;
  }
}

/** sha256(lower(trim(identifier))) as hex, matching src/context/AuthContext.tsx computeLookupHash. */
export async function lookupHash(identifier: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier.trim().toLowerCase()));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const TEST_KDF = { memoryKiB: 65536, iterations: 3, parallelism: 4, keyLengthBytes: 32 };
