/**
 * Vault Business Logic Service
 */

import { AppError } from '../errors/AppError';
import { VaultRepository } from '../repositories/VaultRepository';
import type { SyncVaultDto } from '../types';

export class VaultService {
  private vaultRepo: VaultRepository;

  constructor(db: D1Database) {
    this.vaultRepo = new VaultRepository(db);
  }

  async getVault(userId: string) {
    const vault = await this.vaultRepo.findByUserId(userId);
    if (!vault) {
      throw AppError.notFound('Vault not found');
    }

    return {
      vaultId: vault.id,
      revision: vault.current_revision,
      cryptoVersion: vault.crypto_version,
      encryptedPayload: vault.encrypted_payload,
      iv: vault.iv,
      updatedAt: vault.updated_at,
    };
  }

  async syncVault(userId: string, dto: SyncVaultDto) {
    const currentVault = await this.vaultRepo.findByUserId(userId);
    if (!currentVault) {
      throw AppError.notFound('Vault not found');
    }

    // Optimistic Concurrency Check
    if (currentVault.current_revision !== dto.expectedRevision) {
      throw AppError.conflict('Vault has been modified by another session. Please merge changes.', {
        currentRevision: currentVault.current_revision,
        encryptedPayload: currentVault.encrypted_payload,
        iv: currentVault.iv,
      });
    }

    const now = Date.now();
    const nextRevision = currentVault.current_revision + 1;

    const success = await this.vaultRepo.updateVaultWithRevision(
      currentVault,
      nextRevision,
      dto.encryptedPayload,
      dto.iv,
      now
    );

    if (!success) {
      throw AppError.conflict('Concurrent modification detected during atomic write.', {
        currentRevision: currentVault.current_revision,
      });
    }

    return {
      success: true,
      revision: nextRevision,
      updatedAt: now,
    };
  }

  async listRevisions(userId: string, limit: number = 20) {
    const vault = await this.vaultRepo.findByUserId(userId);
    if (!vault) {
      throw AppError.notFound('Vault not found');
    }

    const revisions = await this.vaultRepo.getRevisions(vault.id, limit);
    return { revisions };
  }

  async getRevision(userId: string, revisionNumber: number) {
    const vault = await this.vaultRepo.findByUserId(userId);
    if (!vault) {
      throw AppError.notFound('Vault not found');
    }

    const historical = await this.vaultRepo.getRevision(vault.id, revisionNumber);
    if (!historical) {
      throw AppError.notFound('Revision not found');
    }

    return {
      revision: historical.revision,
      cryptoVersion: historical.crypto_version,
      encryptedPayload: historical.encrypted_payload,
      iv: historical.iv,
      createdAt: historical.created_at,
    };
  }
}
