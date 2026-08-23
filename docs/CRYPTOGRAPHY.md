# Surakshit Vault Cryptographic Specification & Architecture

Version: 1.0.0  
Status: Active  

---

## 1. Overview & Security Philosophy

Surakshit Vault is a zero-knowledge personal password vault. Sensitive credentials, notes, payment cards, identities, and TOTP secrets are encrypted on the client device prior to transmission over HTTPS. The server (Cloudflare Worker + Cloudflare D1) stores only ciphertext blobs and zero-knowledge verifiers, possessing no keys or technical capability to decrypt vault data.

### Absolute Cryptographic Rules:
1. **Never transmit the master password**: The plaintext master password is never sent to the server or stored in local storage, logs, error reporting, or telemetry.
2. **Never transmit unencrypted secrets**: Vault items, usernames, passwords, notes, and TOTP secrets are encrypted client-side using authenticated encryption.
3. **No custom cryptography**: Surakshit Vault exclusively utilizes standard, audited cryptographic algorithms (Argon2id, HKDF-SHA256, AES-256-GCM, HMAC-SHA1/256/512) and native browser `crypto.subtle` primitives.
4. **Authenticity & Integrity**: All encrypted blobs utilize 128-bit authentication tags to prevent chosen-ciphertext, bit-flipping, and tampering attacks.
5. **Domain Separation**: All cryptographic subkeys are derived using HKDF with distinct domain separation strings to guarantee cryptographic independence.

---

## 2. Key Derivation & Hierarchy

```
+-------------------------------------------------------------------------+
|                              Master Password                            |
+------------------------------------+------------------------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |            Argon2id KDF               |
                 |  - Salt: 32 bytes CSPRNG              |
                 |  - Memory: 65,536 KiB (64 MiB)        |
                 |  - Iterations: 3                      |
                 |  - Parallelism: 4                     |
                 |  - Output: 256 bits (32 bytes)        |
                 +-------------------+-------------------+
                                     |
                                     v
                        +-------------------------+
                        |  Master Derivation Key  |
                        |      (256-bit IKM)      |
                        +------------+------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+-------------------------------+               +-------------------------------+
|       HKDF-Expand (SHA-256)   |               |       HKDF-Expand (SHA-256)   |
| info: "aegis-auth-key-v1"     |               | info: "aegis-kek-v1"          |
| length: 32 bytes              |               | length: 32 bytes              |
+---------------+---------------+               +---------------+---------------+
                |                                               |
                v                                               v
     +---------------------+                        +-------------------------+
     |   AuthKey (256-bit) |                        | Key Encryption Key(KEK) |
     +----------+----------+                        +------------+------------+
                |                                                |
                v                                                v
   +-------------------------+                     +---------------------------+
   |   SHA-256 Auth Verifier |                     |  AES-256-GCM Key Wrap     |
   | (Sent to Worker API)    |                     |  - IV: 12 bytes CSPRNG    |
   +-------------------------+                     |  - Wraps 256-bit VEK      |
                                                   +-------------+-------------+
                                                                 |
                                                                 v
                                                   +---------------------------+
                                                   | Encrypted Vault Key (EVK) |
                                                   |    (Stored on Server)     |
                                                   +---------------------------+
```

### 2.1 Password KDF: Argon2id
- **Algorithm**: Argon2id (RFC 9106)
- **Parameters**:
  - Memory: 64 MiB (65,536 KiB)
  - Iterations: 3
  - Parallelism: 4 lanes
  - Key Length: 32 bytes (256 bits)
  - Salt: 32 bytes generated via `crypto.getRandomValues()`

### 2.2 Domain Separation: HKDF-SHA256
Standard HKDF (RFC 5869) extracts and expands the Master Derivation Key into mutually distinct keys:
1. `AuthKey = HKDF-Expand(MDK, "aegis-auth-key-v1", 32)`
2. `KEK = HKDF-Expand(MDK, "aegis-kek-v1", 32)`
3. `RecoveryKEK = HKDF-Expand(MDK_rec, "aegis-recovery-kek-v1", 32)`

---

## 3. High-Performance Bulk Vault Import & Sync

- **Atomic Batch Engine**: All imported items (e.g. 542+ Bitwarden records) and preserved folders (`Personal`, `Work`, `Finance`) are indexed and merged in-memory in $< 50\text{ ms}$.
- **Fingerprint Deduplication**: Normalizes `type + name + folder + username/url` to eliminate accidental duplicates.
- **Single-Transaction Sync**: The entire resulting vault is authenticated with AES-256-GCM and synchronized in **one atomic HTTP request**, eliminating rate-limiting bottlenecks.
