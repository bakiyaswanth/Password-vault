# AegisVault Threat Model & Risk Analysis

This document provides a comprehensive security and threat modeling analysis for AegisVault based on the STRIDE framework and zero-knowledge threat boundaries.

---

## 1. Trust Boundaries & Assumptions

```
+-------------------------------------------------------------------------+
| TRUSTED ZONE: User's Browser Process (Ephemeral Memory & Web Crypto)     |
| - Master Password, AuthKey, KEK, VEK, Plaintext Items, TOTP Codes       |
+------------------------------------+------------------------------------+
                                     |
                             UNTRUSTED BOUNDARY
                             (Encrypted HTTPS)
                                     |
+------------------------------------+------------------------------------+
| UNTRUSTED ZONE: Cloudflare Worker API & Cloudflare D1 Database           |
| - Ciphertext Blobs, Salt, Argon2id Verifiers, Hashed Session Tokens     |
+-------------------------------------------------------------------------+
```

### Assumptions:
1. **Host Integrity**: The user's device is reasonably free from active keyloggers, screen recording malware, or rogue browser extensions.
2. **Cryptographic Primitives**: Web Crypto API implementation in modern browsers is secure and uncompromised.
3. **Transport**: TLS 1.3 encryption prevents interception in transit.

---

## 2. STRIDE Threat Matrix

| Threat Category | Potential Attack Vector | Impact | AegisVault Mitigation | Residual Risk |
|---|---|---|---|---|
| **Database Compromise (Information Disclosure)** | Attacker gains full read access to Cloudflare D1 database. | High | D1 stores only AES-256-GCM encrypted blobs and salted verifiers. Master passwords, vault keys, and plaintext records are nonexistent on server. | Attacker could attempt offline dictionary attacks against weak master passwords (mitigated by Argon2id 64MB memory cost). |
| **Server / Worker Compromise (Tampering / Spoofing)** | Malicious actor or rogue insider modifies Worker code. | High | Worker never receives plaintext secrets. Optimistic concurrency tags and HMAC/AEAD prevent undetected payload tampering. | If frontend bundle is modified, malicious code could capture secrets (see Critical Limitation). |
| **Brute Force & Credential Stuffing (Spoofing)** | Distributed botnet attempts password guessing against `/api/auth/login`. | Medium | Sliding-window IP and account rate limiting (D1/Worker limits). High-cost Argon2id client-side derivation slows down offline attacks. | Weak master passwords chosen by users remain vulnerable to targeted dictionary attacks. |
| **Account Enumeration (Information Disclosure)** | Attacker queries `/api/auth/prelogin` to test if an email exists. | Low | Endpoint returns a deterministic pseudo-random fake salt using HMAC(ServerPepper, email) in constant time for nonexistent accounts. | None. Server response looks identical for registered and unregistered accounts. |
| **Cross-Site Scripting (XSS) (Elevation of Privilege)** | Malicious script injected into web context. | Critical | Strict Content Security Policy (`script-src 'self'`, `object-src 'none'`), no external scripts or trackers, React auto-escaping, no `dangerouslySetInnerHTML`. | Browser extensions with global DOM access could potentially inspect rendered fields. |
| **Session Theft / Hijacking (Spoofing)** | Attacker intercepts session token. | High | Session cookies configured with `HttpOnly; Secure; SameSite=Strict`. Session tokens hashed with SHA-256 in D1. Manual session revocation from settings. | Malware on client device with cookie access could hijack active session (mitigated by vault auto-lock requiring re-authentication). |
| **Insecure Direct Object Reference (IDOR)** | User modifies user_id or vault_id in API request. | High | Worker enforces authentication middleware that derives user ID strictly from the verified session token in D1, ignoring client-supplied IDs. | None. |
| **Clipboard Snooping (Information Disclosure)** | Background applications reading OS clipboard after user copies password. | Medium | Built-in clipboard manager automatically overwrites clipboard buffer after 30 seconds with real-time UI countdown. | Applications with active clipboard listening hooks could capture the value before the 30-second clear timer fires. |
| **In-Memory Scraping after Lock** | Attacker dumps browser process memory after user locks vault. | Medium | Explicit zeroization overwrites `vaultKey` with zeros (`key.fill(0)`) and purges all decrypted React and memory store states on lock or inactivity. | JavaScript garbage collection does not guarantee immediate physical OS RAM zeroization. |

---

## 3. Critical Web Application Limitation

> [!CAUTION]
> **Fundamental Browser Limitation Statement:**  
> A browser-based password manager cannot guarantee security if the production frontend bundle delivered to the user's browser is modified or compromised at the CDN/hosting layer.

To mitigate this limitation, AegisVault adopts the following DevSecOps controls:
1. **Zero External Scripts**: 100% of code, icons, and libraries are bundled in `dist/`. No CDNs, tracking scripts, Google Analytics, or third-party fonts.
2. **Immutable CSP**: Strict Content Security Policy blocking remote scripts and arbitrary `eval()`.
3. **Automated CI/CD Verification**: GitHub Actions enforces dependency review, TypeScript strict checks, and automated crypto regression test suites on every pull request.
4. **Encrypted Local Backups**: Regular `.aegisvault` or Bitwarden JSON backups allow complete data recovery independent of Cloudflare infrastructure.
