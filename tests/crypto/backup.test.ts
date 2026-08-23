import { describe, it, expect } from 'vitest';
import { createEncryptedBackup, restoreEncryptedBackup } from '../../src/crypto/backup';
import { BackupIntegrityError, DecryptionError } from '../../src/crypto/errors';

describe('Encrypted Backup & Restore Engine', () => {
  const sampleVault = {
    items: [
      { id: '1', name: 'Email Account', username: 'user@example.com', password: 'P@ssword123!' },
      { id: '2', title: 'Server Access SSH Note', content: 'ssh-rsa AAAAB3NzaC1yc2E...' },
    ],
  };
  const backupPassword = 'BackupSecretPassword2026!';

  it('creates and restores an encrypted backup without data loss', async () => {
    const backupJson = await createEncryptedBackup(sampleVault, backupPassword);
    expect(typeof backupJson).toBe('string');
    expect(backupJson).toContain('AEGISVAULT_BACKUP_V1');
    // Ensure plaintext is NOT in the backup JSON
    expect(backupJson).not.toContain('P@ssword123!');
    expect(backupJson).not.toContain('ssh-rsa');

    const restored = await restoreEncryptedBackup<typeof sampleVault>(backupJson, backupPassword);
    expect(restored).toEqual(sampleVault);
  });

  it('fails restore if the backup checksum does not match', async () => {
    const backupJson = await createEncryptedBackup(sampleVault, backupPassword);
    const parsed = JSON.parse(backupJson);
    parsed.checksum = '0000000000000000000000000000000000000000000000000000000000000000';

    await expect(
      restoreEncryptedBackup(JSON.stringify(parsed), backupPassword)
    ).rejects.toThrow(BackupIntegrityError);
  });

  it('fails restore if an incorrect backup password is provided', async () => {
    const backupJson = await createEncryptedBackup(sampleVault, backupPassword);

    await expect(
      restoreEncryptedBackup(backupJson, 'WrongPassword999!')
    ).rejects.toThrow(DecryptionError);
  });
});
