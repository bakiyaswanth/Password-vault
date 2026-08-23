import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';

export const RecoveryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newMasterPass, setNewMasterPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  const { recoverVault } = useAuth();

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !recoveryPhrase.trim() || !newMasterPass) {
      setError('Please fill in all recovery fields.');
      return;
    }

    if (newMasterPass !== confirmPass) {
      setError('Master passwords do not match.');
      return;
    }

    if (newMasterPass.length < 12) {
      setError('Master password must be at least 12 characters.');
      return;
    }

    setIsRecovering(true);
    setError(null);

    const success = await recoverVault(email, recoveryPhrase, newMasterPass);
    setIsRecovering(false);

    if (success) {
      onClose();
    } else {
      setError('Recovery failed: Please check your email and 24-word recovery phrase.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vault Emergency Recovery"
      description="Use your 24-word emergency recovery phrase to unlock your vault and reset your master password."
      maxWidth="md"
    >
      <form onSubmit={handleRecover} className="space-y-4">
        <Input
          label="Account Email"
          placeholder="your.email@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disableSelection
          required
        />

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            24-Word Recovery Phrase
          </label>
          <textarea
            rows={4}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
            placeholder="paste your 24 words separated by spaces..."
            value={recoveryPhrase}
            onChange={(e) => setRecoveryPhrase(e.target.value)}
            required
          />
        </div>

        <Input
          label="New Master Password"
          isPassword
          placeholder="Enter a strong master password (min 12 chars)"
          value={newMasterPass}
          onChange={(e) => setNewMasterPass(e.target.value)}
          disableSelection
          required
        />

        <Input
          label="Confirm New Master Password"
          isPassword
          placeholder="Re-enter your new master password"
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
          disableSelection
          required
        />

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="shield" type="submit" isLoading={isRecovering}>
            Recover Vault
          </Button>
        </div>
      </form>
    </Modal>
  );
};
