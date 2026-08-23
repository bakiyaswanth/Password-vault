# Security Policy

## Reporting a Vulnerability

Security is the primary design requirement of AegisVault. If you discover a vulnerability, security bug, or cryptographic weakness, please report it responsibly.

### How to Report:
- **Email**: `security@aegisvault.local` (or open a private security advisory on GitHub).
- **Include**:
  - Detailed description of the vulnerability.
  - Steps to reproduce or proof-of-concept.
  - Potential impact and affected components.

Please **do not** report vulnerabilities through public GitHub issues.

### Coordinated Disclosure Policy
- We will acknowledge receipt of your vulnerability report within 48 hours.
- We will provide an initial assessment and timeline for a remediation patch.
- We request that you avoid public disclosure until a patch has been published.

---

## Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| < 1.0 | No |

---

## Cryptographic Principles & Commitments
1. **Zero Knowledge**: Plaintext passwords, master keys, notes, cards, and TOTP secrets are never received, processed, or stored by the server.
2. **No Backdoors**: There are no administrator master keys, server-side password resets, or undocumented recovery routes.
3. **No Unauthenticated Encryption**: Every ciphertext includes a 128-bit authentication tag.
4. **No Telemetry / Analytics**: No tracking scripts, analytics cookies, or session replays are included in the codebase.
