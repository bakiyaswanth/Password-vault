Yes — here is a single copy-paste prompt you can give Antigravity. It tells it to design, build, test, harden, and deploy the entire project, while keeping the security architecture explicit.

You are an expert security engineer, cryptography engineer, React/TypeScript engineer, Cloudflare Workers engineer, database architect, penetration tester, and DevSecOps engineer.

Build a complete, production-quality personal password manager/password vault called [choose an original project name].

The application should provide a polished, modern password-manager experience inspired by the general usability of products such as Proton Pass, Bitwarden, and 1Password, but it must use 100% original code, branding, UI, assets, and implementation. Do not copy proprietary code, logos, assets, or exact UI layouts.

The primary goal is:

Build a privacy-first, zero-knowledge password vault where sensitive vault data is encrypted on the user's device before it reaches the server.

The application is initially intended for one personal user, but the architecture should be clean enough to support additional users later.

The target deployment should be $0/month where possible using Cloudflare's free tiers.

MASTER REQUIREMENTS

Use:

React
TypeScript
Vite
Tailwind CSS
Cloudflare Pages
Cloudflare Workers
Cloudflare D1
Web Crypto API where appropriate
A reputable, maintained cryptographic library when Web Crypto does not provide the required primitive
GitHub

Do NOT require:

VPS
Docker server
Firebase
Supabase
paid database
paid authentication provider
traditional backend server

unless there is a compelling security reason. If one becomes necessary, explain why.

Design the system so the personal version can realistically operate within Cloudflare's free-tier limits.

ABSOLUTE SECURITY RULES

These rules are mandatory.

The master password MUST NEVER be sent to the backend.

The master password MUST NEVER be stored in:

Cloudflare
D1
Worker logs
localStorage
sessionStorage
cookies
URLs
analytics
error-reporting systems

The backend MUST NEVER receive plaintext:

passwords
TOTP secrets
secure notes
credit-card information
identity information
vault encryption keys

The backend should store encrypted ciphertext wherever sensitive data is involved.

Never implement:

custom cryptography
custom password hashing
custom KDF
homemade encryption
predictable randomness
Math.random() for security
MD5
SHA-1 as a password KDF
plain SHA-256 as a password KDF
ECB
unauthenticated encryption
plaintext backups
administrator decryption backdoors

Use established cryptographic algorithms and maintained implementations.

If a security decision is uncertain, stop and explain the issue rather than inventing a solution.

Never sacrifice security merely to make a feature easier to implement.

ARCHITECTURE

Use this architecture:

                     USER
                       |
                       v
              +------------------+
              | React + TypeScript|
              | Cloudflare Pages |
              +--------+---------+
                       |
                     HTTPS
                       |
                       v
              +------------------+
              | Cloudflare Worker|
              | API/Auth/Sync    |
              +--------+---------+
                       |
                       v
              +------------------+
              | Cloudflare D1    |
              | Encrypted Data   |
              +------------------+


The browser performs:

key derivation
encryption
decryption
vault search
password generation
TOTP generation
sensitive data processing

The Worker performs:

authentication
authorization
rate limiting
encrypted vault storage
synchronization
revision management
session management

D1 stores:

encrypted vault data
encrypted metadata where necessary
opaque identifiers
authentication-related data
synchronization metadata
timestamps
revisions

D1 must not store plaintext vault contents.

ZERO-KNOWLEDGE DESIGN

The server should operate under the assumption:

"The database could be compromised."

If an attacker obtains:

D1 database
encrypted vault
encrypted revisions
Worker database access

they should not automatically obtain plaintext vault credentials.

The server should not possess the keys required to decrypt the user's vault.

Clearly document the exact trust model.

CRYPTOGRAPHIC KEY ARCHITECTURE

Design a proper key hierarchy.

Use a conceptual architecture such as:

Master Password
|
v
Strong Password KDF
|
v
Key Encryption Key
|
v
Encrypted Vault Key
|
v
Random Vault Encryption Key
|
v
Encrypted Vault

Do not directly use the master password as an AES key.

Generate the vault encryption key using a cryptographically secure random generator.

Use unique random salts and IVs/nonces.

Use authenticated encryption.

Prefer AES-256-GCM where appropriate.

Use Argon2id through a reputable, maintained implementation where appropriate and practical.

Do NOT implement Argon2 yourself.

If the selected environment makes Argon2id impractical, evaluate another appropriate, well-reviewed password KDF and document the trade-off.

Use cryptographic key separation/domain separation where appropriate.

Document:

KDF
parameters
salt generation
encryption algorithm
IV/nonce generation
key sizes
authentication tag
key wrapping
key rotation
format versioning

Create:

docs/CRYPTOGRAPHY.md

ENCRYPTION FORMAT

Create a versioned encrypted data format.

Every encrypted object must contain enough metadata to determine how it should be decrypted without exposing secrets.

Example conceptual structure:

{
version,
algorithm,
kdf,
salt,
iv,
ciphertext
}

Do not blindly copy this example.

Design the actual format securely.

Use explicit cryptographic versioning so algorithms can be migrated later.

For example:

CRYPTO_VERSION = 1

Never silently change cryptographic parameters.

ACCOUNT AUTHENTICATION

Separate:

ACCOUNT AUTHENTICATION

from:

VAULT ENCRYPTION.

The authentication system must not give the backend the ability to decrypt the vault.

Evaluate using a mature PAKE such as OPAQUE or SRP if appropriate.

Do NOT implement a PAKE protocol yourself.

If using a conventional authentication architecture initially, document exactly what is sent to the server and what the server stores.

Implement:

registration
login
logout
session expiration
session revocation
account deletion
rate limiting

Support WebAuthn/passkeys as an optional authentication mechanism if it can be implemented securely.

Do not claim WebAuthn automatically replaces the vault encryption key.

VAULT FEATURES

Implement the following item types.

Login

Fields:

name
username
password
URLs
notes
TOTP
custom fields
favorite
tags/folder
Secure Note

Fields:

title
content
tags/folder
favorite
Credit Card

Fields:

cardholder name
card number
expiration
CVV
PIN if user explicitly chooses to store it
notes
Identity

Fields:

full name
email
phone
address
date of birth if desired
custom fields
Custom Item

Allow arbitrary user-defined encrypted fields.

Sensitive fields must be encrypted before leaving the browser.

PASSWORD GENERATOR

Implement a cryptographically secure password generator.

Support:

configurable length
uppercase
lowercase
numbers
symbols
passphrases
configurable word count
ambiguous-character exclusion
password strength indicator

Use cryptographically secure randomness.

Never use Math.random().

Default generated password length should be at least 20 characters unless the user changes it.

Allow longer passwords.

TOTP

Implement client-side TOTP.

Support RFC 6238-compatible TOTP.

Support:

6 digits
8 digits
configurable period
SHA-1
SHA-256
SHA-512 where appropriate

The plaintext TOTP secret must never reach the backend.

Generate the TOTP code locally.

Make copying the TOTP code easy.

Do not log TOTP secrets or generated codes.

SEARCH

Search must happen locally after decrypting the vault.

Never send plaintext search queries to the server.

Do not implement server-side plaintext search.

VAULT LOCKING

Implement automatic vault locking.

Options:

1 minute
5 minutes
15 minutes
30 minutes
Never

Default:

5 minutes.

Provide:

"Lock Now"

When locked:

clear decrypted vault state
clear sensitive React state
clear visible passwords
clear TOTP state
invalidate temporary cryptographic references where practical
require unlock again

Clearly document that browser/JavaScript memory cannot guarantee perfect cryptographic zeroization.

LOCAL STORAGE

Do not store the master password.

Do not store plaintext vault data.

Do not store plaintext encryption keys.

If IndexedDB is used, encrypt any sensitive persistent data.

Document exactly what is stored locally and why.

Avoid persistence unless necessary.

BACKUP

Implement:

Export Encrypted Vault

Import Encrypted Vault

The backup must remain encrypted.

Never automatically generate plaintext JSON backups.

The backup format must be versioned.

Provide integrity validation during import.

Reject corrupted or tampered backups.

RECOVERY

Do not create a server-side password reset that decrypts the vault.

If the user forgets their master password and has no recovery mechanism, the vault may be unrecoverable.

Provide an optional recovery-key system if it can be implemented securely.

Recovery keys should be:

high entropy
generated with cryptographically secure randomness
never stored plaintext on the server
explicitly displayed to the user
exportable securely
clearly explained

Never create a hidden recovery backdoor.

SYNCHRONIZATION

Implement encrypted synchronization.

The client encrypts the vault.

The server stores the encrypted vault.

Use:

revision numbers
timestamps
optimistic concurrency
conflict detection

The backend must never decrypt the vault to resolve conflicts.

Conflict resolution must occur client-side.

Minimize database writes to remain compatible with free-tier usage.

DATABASE

Use Cloudflare D1.

Design tables such as:

users
sessions
vaults
vault_revisions
webauthn_credentials

Adjust the schema if a better design is justified.

Never store plaintext secrets.

Use opaque IDs.

Add migrations.

Use foreign keys and appropriate indexes.

API

Create a minimal secure API.

Possible structure:

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/webauthn/register
POST /api/auth/webauthn/login

GET /api/vault
PUT /api/vault

GET /api/vault/revisions
POST /api/vault/revisions

DELETE /api/account

Adjust if required.

Every API endpoint must have:

authentication
authorization
validation
rate limiting
secure error handling
safe CORS
appropriate CSRF protection
no secret leakage

Prevent IDOR/insecure direct object references.

A user must never be able to access another user's vault by changing an ID.

SESSION SECURITY

Use secure session handling.

If cookies are used, configure:

Secure
HttpOnly
SameSite

Do not put session tokens in URLs.

Do not unnecessarily store long-lived tokens in localStorage.

Implement:

expiration
revocation
logout
device/session management
RATE LIMITING

Rate-limit:

login
registration
authentication
password-reset/recovery operations
vault writes
account deletion
WebAuthn operations

Avoid account enumeration.

Do not reveal whether an account exists through different responses.

SECURITY HEADERS

Configure strong security headers including appropriate:

Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Frame-ancestors

Avoid unsafe-eval.

Avoid unsafe-inline wherever practical.

Use Trusted Types where practical.

CORS

Never blindly use:

Access-Control-Allow-Origin: *

for authenticated APIs.

Restrict origins appropriately.

Handle credentials securely.

FRONTEND SECURITY

Use React safely.

Avoid:

dangerouslySetInnerHTML

unless absolutely necessary and properly sanitized.

Do not execute arbitrary HTML or JavaScript.

Validate all external input.

Avoid unnecessary dependencies.

Do not load:

analytics
advertisements
tracking scripts
session recording
third-party marketing scripts

Minimize third-party JavaScript.

CLIPBOARD

Provide secure copy actions.

When copying passwords:

optionally clear clipboard after a configurable delay where browser behavior permits
never log clipboard contents
never send clipboard contents to the server

Clearly warn users about clipboard exposure.

UI/UX

Create a polished, modern, original password-manager interface.

Do not clone Proton Pass.

Desktop navigation:

All Items
Favorites
Logins
Secure Notes
Credit Cards
Identities
Folders
Trash

Main interface:

search
item list
item details
add item
edit item
delete
restore
password generator
copy
reveal
TOTP

Settings:

Security
Auto-lock
Password Generator
Devices
Sessions
Backup
Recovery
Account
About

Use:

dark mode
light mode
responsive design
accessible controls
keyboard navigation
mobile-friendly UI

Use an original visual identity.

MOBILE

Make the application responsive.

On mobile:

touch-friendly controls
bottom navigation where appropriate
large buttons
safe password reveal/copy
responsive item editor
responsive password generator
ACCESSIBILITY

Support:

semantic HTML
keyboard navigation
screen readers
visible focus
appropriate ARIA
sufficient contrast
reduced motion
AUTOFILL

Do not implement aggressive browser autofill in the initial web application.

A browser extension can be developed later.

If implementing an extension later:

require explicit origin permissions
use strict origin matching
minimize content-script privileges
do not expose the entire vault to arbitrary websites
protect against phishing domains
PASSWORD EXPOSURE

Passwords must be hidden by default.

Provide:

Reveal
Copy
Edit
Generate

Avoid unnecessarily rendering sensitive values.

Do not put sensitive values into page titles, URLs, browser history, analytics, or logs.

SECURITY LOGGING

Never log:

master password
vault
passwords
TOTP secrets
TOTP codes
encryption keys
recovery keys
session tokens
credit card numbers

Create safe logging utilities.

Review every log statement before production.

ERROR HANDLING

Errors must never contain sensitive data.

Avoid errors such as:

"Invalid password: MySecretPassword123"

Never include secrets in stack traces sent to remote systems.

Use generic user-facing messages where appropriate.

SUPPLY-CHAIN SECURITY

Minimize dependencies.

For every security-sensitive dependency:

explain why it is required
use a maintained project
pin versions
use a lockfile
audit dependencies
inspect transitive dependencies
avoid abandoned crypto packages

Run:

npm audit

or the appropriate equivalent.

Use GitHub Dependabot if available.

SOURCE CODE STRUCTURE

Use a structure similar to:

src/

components/

pages/

features/

auth/

vault/

login/

notes/

cards/

identities/

totp/

generator/

settings/

sync/


crypto/

kdf.ts
keys.ts
encrypt.ts
decrypt.ts
random.ts
encoding.ts
formats.ts
errors.ts


storage/

api/

security/

types/

worker/

api/

auth/

database/

middleware/

tests/

docs/

SECURITY.md
THREAT_MODEL.md
README.md

wrangler.toml

package.json

tsconfig.json

.env.example

Adjust the structure if needed.

Do not put cryptographic logic inside React components.

TYPESCRIPT

Use strict TypeScript.

Avoid any where practical.

Create strong types for:

EncryptedBlob
CryptoMetadata
Vault
VaultItem
LoginItem
SecureNote
CardItem
IdentityItem
Session
User
Revision
WebAuthnCredential

TESTING

Create comprehensive tests.

Crypto

Test:

encryption
decryption
wrong key
wrong password
corrupted ciphertext
modified IV
modified authentication tag
random IV
key derivation
key wrapping
version handling
Vault

Test:

creation
editing
deletion
restoration
locking
unlocking
search
synchronization
conflicts
Authentication

Test:

registration
login
logout
expiration
revocation
rate limiting
WebAuthn
Security

Test:

XSS
CSRF
CORS
authorization
IDOR
session fixation
input validation
sensitive logging
dependency vulnerabilities
SECURITY AUDIT

Before declaring the project finished, perform a self-audit.

Verify:

[ ] Master password never reaches backend

[ ] Plaintext passwords never reach backend

[ ] Plaintext vault never reaches backend

[ ] Plaintext vault never enters D1

[ ] TOTP secrets remain client-side

[ ] Recovery material is protected

[ ] No plaintext backups

[ ] No Math.random() for security

[ ] No custom cryptography

[ ] No insecure password hashing

[ ] No plaintext secrets in logs

[ ] No secrets in URLs

[ ] No secrets in localStorage

[ ] No unsafe CORS

[ ] No obvious XSS

[ ] No obvious CSRF

[ ] IDOR protections exist

[ ] Rate limiting exists

[ ] Session invalidation works

[ ] Dependency audit passes

[ ] TypeScript strict mode passes

[ ] Tests pass

[ ] Production build succeeds

THREAT MODEL

Create:

docs/THREAT_MODEL.md

Analyze:

database compromise
Worker compromise
Cloudflare compromise
frontend deployment compromise
malicious JavaScript
XSS
CSRF
account takeover
credential stuffing
brute force
offline database attacks
malicious browser extension
malware on user's device
phishing
clipboard theft
device theft
weak master password
recovery-key theft
dependency compromise
supply-chain attacks
insider threat
session theft
backup theft

For each threat explain:

attack
impact
mitigation
residual risk
CRITICAL WEB APPLICATION LIMITATION

Document prominently:

A browser password manager cannot guarantee protection if an attacker fully compromises the JavaScript delivered to the user's browser.

If the production frontend is compromised, malicious JavaScript could potentially capture secrets.

Therefore implement and document:

protected production branch
mandatory code review
dependency scanning
secret scanning
minimal dependencies
strict CSP
no third-party scripts
secure deployment
controlled releases
rollback capability

Never hide this limitation.

GITHUB

Create a secure .gitignore.

Never commit:

.env
.env.*
private keys
tokens
credentials
production secrets
unencrypted backups

Configure where possible:

Dependabot
secret scanning
branch protection
pull requests
dependency review
CLOUDFLARE

Deploy using:

Cloudflare Pages
Cloudflare Workers
Cloudflare D1

Provide complete deployment configuration.

Create:

wrangler.toml

or the current recommended Cloudflare configuration format.

Provide:

local development
D1 creation
migrations
Worker deployment
Pages deployment
secrets configuration
environment configuration
production configuration
rollback procedure

Use Cloudflare's free tier where possible.

Clearly identify anything that could incur charges.

Do not assume paid services.

PERFORMANCE

Optimize:

JavaScript bundle
initial load
lazy loading
vault loading
database requests
synchronization
storage

Do not compromise security for performance.

PRIVACY

The application must have:

no analytics
no tracking
no advertising
no session replay
no third-party telemetry

Do not send vault contents to any external service.

Do not send passwords to AI APIs.

Do not send vault contents to Cloudflare analytics.

SECURITY POLICY

Create SECURITY.md explaining:

security architecture
reporting vulnerabilities
cryptographic design
supported versions
threat model
limitations

Do not expose private vulnerability reports publicly before remediation.

README

Create a professional README explaining:

what the application does
architecture
zero-knowledge design
security model
installation
local development
Cloudflare deployment
database migration
environment configuration
backup/recovery
limitations
free-tier deployment
development commands

Include diagrams where useful.

DEPLOYMENT

The final application should be deployable approximately as follows:

Clone repository
Install dependencies
Configure Cloudflare
Create D1 database
Run migrations
Configure Worker secrets
Build React application
Deploy Pages
Deploy Worker
Test production environment
Perform security verification

Provide exact commands appropriate for the versions of the tools actually selected.

Do not invent Cloudflare commands. Verify current commands against official Cloudflare documentation when possible.

FREE-TIER DESIGN

Optimize for one personal user.

Avoid:

unnecessary polling
excessive database writes
unnecessary API calls
unnecessary storage
huge assets
server-side encryption work that can happen safely in the browser

Prefer:

client-side processing
encrypted blob synchronization
event-driven operations
minimal API calls

Document current Cloudflare free-tier limits in the README rather than hardcoding assumptions.

PASSWORD MANAGER DATA MODEL

Design the encrypted vault so the backend sees something conceptually like:

{
"vaultId": "opaque-id",
"revision": 123,
"cryptoVersion": 1,
"ciphertext": "encrypted-data"
}

The actual vault plaintext may contain:

{
"items": [
{
"type": "login",
"name": "Example",
"username": "...",
"password": "...",
"totp": "...",
"urls": [...]
}
]
}

But this plaintext structure MUST NOT be sent to or stored on the backend.

Only encrypted data should cross the trust boundary.

SECURITY UX

When the vault is locked, show:

"Vault Locked"

When unlocked:

"Vault Unlocked"

Provide a clear lock button.

Before exporting:

"Your backup is encrypted. Keep the backup and recovery information in a secure location."

Before deleting the account:

"Account deletion may permanently destroy your encrypted vault."

Do not use frightening or misleading security claims.

NO FAKE SECURITY

Do not add superficial security features merely to claim security.

Examples of unacceptable behavior:

Calling SHA-256 "encryption"
Base64-encoding passwords and calling it encryption
Hashing a password once and using the hash directly as an encryption key
Sending the master password over HTTPS and claiming the system is zero-knowledge
Storing an encryption key in localStorage without justification
Giving the backend a master key
Calling Cloudflare's database "encrypted" as a substitute for client-side encryption

Security must be technically meaningful.

SECURITY-FIRST DEVELOPMENT

If you discover that an earlier implementation is insecure:

Stop.
Explain the vulnerability.
Fix the architecture.
Update tests.
Update documentation.
Re-audit affected components.

Do not preserve an insecure design merely because it has already been implemented.

FINAL ACCEPTANCE CRITERIA

The application is complete only when:

React frontend works.
Cloudflare Worker works.
D1 database works.
User can register.
User can authenticate.
User can create/unlock a vault.
Vault is encrypted client-side.
User can create login entries.
User can create secure notes.
User can create cards.
User can create identities.
User can generate strong passwords.
User can generate TOTP codes.
User can search locally.
User can copy secrets.
User can lock the vault.
Auto-lock works.
Encrypted synchronization works.
Encrypted backup export works.
Encrypted backup import works.
Account/session management works.
Rate limiting works.
Security headers are configured.
CORS is correctly restricted.
No plaintext vault data is stored server-side.
No master password is sent server-side.
Tests pass.
TypeScript strict checks pass.
Dependency audit is performed.
Production build succeeds.
Cloudflare deployment succeeds.
Documentation is complete.
Security limitations are clearly documented.
IMPORTANT FINAL INSTRUCTION

Do not merely create a visually convincing password manager.

Create an application whose security architecture is the primary design requirement.

Do not make unsupported claims such as "unhackable", "100% secure", "military-grade", or "most secure".

Use precise technical language.

When a security property cannot be guaranteed, explicitly state the limitation.

Build the application incrementally, but do not stop after creating mockups.

The final result must contain:

working frontend
working backend
working database
real client-side encryption
real authentication
real encrypted synchronization
real password generation
real TOTP
encrypted backups
security tests
deployment configuration
complete documentation

Before finishing, inspect the complete repository for:

hardcoded secrets
insecure cryptography
plaintext credential handling
unsafe dependencies
accidental logging
insecure Cloudflare configuration
authorization bugs
XSS
CSRF
IDOR
session vulnerabilities

Fix discovered issues before declaring the project complete.

Do not tell me the project is secure merely because the tests pass.

Clearly state what has been tested, what has not been independently audited, and what risks remain.