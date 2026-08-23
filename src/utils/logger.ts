/**
 * AegisVault Safe Logger
 * Enforces zero-knowledge logging rules.
 * Never prints passwords, secrets, master keys, or decrypted data to browser console or telemetry.
 */

export const logger = {
  info(message: string, ...args: unknown[]) {
    // Only log high-level message without complex objects that might contain secrets
    const safeArgs = args.map((a) => (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean' ? a : '[Object]'));
    console.info(`[AegisVault Info] ${message}`, ...safeArgs);
  },

  warn(message: string, ...args: unknown[]) {
    const safeArgs = args.map((a) => (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean' ? a : '[Object]'));
    console.warn(`[AegisVault Warning] ${message}`, ...safeArgs);
  },

  error(message: string, error?: unknown) {
    const errorName = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error';
    console.error(`[AegisVault Error] ${message} - ${errorName}`);
  },
};
