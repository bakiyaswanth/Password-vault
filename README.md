# 🛡️ Surakshit Vault — Zero-Knowledge Password Manager

Surakshit Vault is a production-grade, privacy-first, zero-knowledge personal password manager built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, **Cloudflare Pages**, **Cloudflare Workers**, and **Cloudflare D1**.

All vault data is encrypted on your local device before transmission using **Argon2id**, **HKDF-SHA256**, and **AES-256-GCM**. The backend acts solely as a blind, authenticated synchronization and revision engine that never receives or stores plaintext credentials, master passwords, or TOTP secrets. Designed for $0/month operation on Cloudflare's free tiers.

---

## ✨ Key Features

- 🔐 **Zero-Knowledge Architecture**: Master passwords and plaintext secrets never leave your device.
- ⚡ **High-Speed Atomic Vault Import**:
  - Instant, bulk migration supporting **Bitwarden JSON (default)**, **Bitwarden CSV**, **Proton Pass JSON/CSV**, and **Chrome CSV**.
  - **100% Folder Preservation**: Automatically maps source categories like **Personal**, **Work**, and **Finance**.
  - **Deduplication Engine**: Prevents duplicate records on repeated or resumed imports.
  - Non-blocking real-time animated progress and detailed completion summaries.
- 🛡️ **Modern Authenticated Cryptography**: Argon2id (64 MiB memory cost) + HKDF-SHA256 key domain separation + AES-256-GCM authenticated encryption.
- 🎨 **Proton Pass-Inspired Modern UI**: Sleek, sectioned layout with dark/light themes, category filters, and quick credential actions.
- 🔑 **CSPRNG Password & Passphrase Generator**: Configurable character sets, ambiguous character filtering, memorable multi-word passphrases, and live entropy rating.
- ⏰ **Client-Side TOTP (RFC 6238)**: Live countdown timer and one-click copy with SHA-1, SHA-256, and SHA-512 support.
- ⏱️ **Inactivity Auto-Lock & Zeroization**: Overwrites in-memory encryption keys (`key.fill(0)`) and clears decrypted items after inactivity or tab blur.
- 📋 **Secure Clipboard Auto-Clear**: Automatically wipes credentials from the system clipboard after 30 seconds with visual countdown.
- 🔄 **Optimistic Concurrency & Revision History**: Conflict detection (`409 Conflict`) with client-side smart merge.
- 🆘 **24-Word Emergency Recovery Phrase**: BIP-39 compatible high-entropy recovery key to restore vault access if master password is forgotten.
- ☁️ **$0/Month Cloudflare Stack**: Cloudflare Pages + Workers + D1 SQLite database.

---

## 🏛️ Architecture Overview

```
                      USER BROWSER (Client)
                                |
             +------------------+------------------+
             |                                     |
    Key Derivation (Argon2id)              AES-256-GCM Vault
    Domain Separation (HKDF)               In-Memory Ephemeral
    Client-side TOTP (RFC 6238)            Search & Auto-Lock
             |                                     |
             +------------------+------------------+
                                |
                      HTTPS (Encrypted Blobs Only)
                                |
                                v
                   +--------------------------+
                   |  Cloudflare Worker API   |
                   |  - Auth Verification     |
                   |  - Rate Limiting         |
                   |  - Revision Management   |
                   +------------+-------------+
                                |
                                v
                   +--------------------------+
                   |  Cloudflare D1 Database  |
                   |  - Ciphertext Blobs      |
                   |  - Revision Snapshots    |
                   |  - Salt & Verifiers      |
                   +--------------------------+
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js** v20+ and **npm** v10+
- (Optional) **Cloudflare Wrangler CLI**

### 2. Installation
```bash
# Clone repository
git clone https://github.com/bakiyaswanth/Password-vault.git
cd Password-vault

# Install dependencies
npm install
```

### 3. Run Automated Tests
```bash
# Run 40+ unit, crypto, bulk importer, and worker tests
npm test
```

### 4. Start Local Development Server
```bash
# Start frontend (Vite)
npm run dev
# App will be accessible at http://localhost:3000

# (Optional) Start Worker API locally with Miniflare & D1
npm run worker:dev
```

---

## ☁️ Cloudflare Deployment Plan ($0/Month Free Tier)

Surakshit Vault is engineered to comfortably operate within Cloudflare's Free Tier quotas for personal use:

| Cloudflare Service | Free Tier Limit | Surakshit Vault Usage (1 User) | Headroom |
|---|---|---|---|
| **Pages** (Frontend) | Unlimited bandwidth / requests | ~500 req/month | >99.9% |
| **Workers** (Backend API) | 100,000 requests/day | ~50-200 req/day | >99.8% |
| **D1 Database** (Reads) | 5,000,000 rows read/day | ~1,000 rows/day | >99.9% |
| **D1 Database** (Writes) | 100,000 rows written/day | ~20-50 rows/day | >99.9% |
| **D1 Storage** | 5 GB total storage | ~2-10 MB | >99.8% |

### Step-by-Step Production Deployment

#### Step 1: Log in to Cloudflare CLI
```bash
npx wrangler login
```

#### Step 2: Create Production D1 Database
```bash
npx wrangler d1 create surakshit-vault-db
```
*(Copy the generated `database_id` into `wrangler.toml`)*

#### Step 3: Run Database Migrations
```bash
# Run schema migration on production D1 database
npx wrangler d1 execute surakshit-vault-db --remote --file=./migrations/0001_initial_schema.sql
```

#### Step 4: Configure Production Worker Secrets
```bash
# Set high-entropy server pepper and session secret
npx wrangler secret put SERVER_PEPPER
npx wrangler secret put SESSION_SECRET
```

#### Step 5: Deploy Worker API & Pages Frontend
```bash
# 1. Deploy Cloudflare Worker API
npm run worker:deploy

# 2. Build and Deploy Cloudflare Pages frontend
npm run pages:deploy
```

---

## 🔒 Cryptographic Details

For full mathematical equations, domain separation strings, key wrapping specs, and IV generation rules, see **[docs/CRYPTOGRAPHY.md](docs/CRYPTOGRAPHY.md)**.

For threat analysis across database compromise, worker breach, XSS, and residual risks, see **[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)**.

For vulnerability disclosure and reporting guidelines, see **[docs/SECURITY.md](docs/SECURITY.md)**.

---

## 🛠️ Development Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite React development server on `localhost:3000` |
| `npm run build` | Compile TypeScript and bundle production assets to `dist/` |
| `npm test` | Run complete Vitest suite (Crypto, Worker, Importers) |
| `npm run typecheck` | Run strict TypeScript checks for frontend and worker |
| `npm run worker:dev` | Run local Cloudflare Worker with local D1 database emulator |
| `npm run db:migrate:local` | Apply SQL migrations to local SQLite test database |
| `npm run db:migrate:remote`| Apply SQL migrations to remote Cloudflare D1 production database |

---

## 📜 License

MIT License. 100% Original Code and Branding.