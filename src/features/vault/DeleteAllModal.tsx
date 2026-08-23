import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

export interface DeleteAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalItemsCount: number;
  onConfirmDeleteAll: () => Promise<void>;
}

export const DeleteAllModal: React.FC<DeleteAllModalProps> = ({
  isOpen,
  onClose,
  totalItemsCount,
  onConfirmDeleteAll,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmInput.trim().toUpperCase() === 'DELETE EVERYTHING';

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    try {
      await onConfirmDeleteAll();
      onClose();
    } finally {
      setIsDeleting(false);
      setConfirmInput('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setConfirmInput('');
        onClose();
      }}
      title="Nuclear Wipe: Delete All Vault Items?"
      description={`This will permanently erase all ${totalItemsCount} items (Logins, Secure Notes, Credit Cards, Identities) from your vault.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            <strong>Warning:</strong> This is a completely destructive, irreversible action. Once erased, your encrypted data cannot be recovered unless you possess an external backup.
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Type <span className="font-mono text-red-600 font-bold">DELETE EVERYTHING</span> to confirm:
          </label>
          <Input
            placeholder="DELETE EVERYTHING"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            disabled={!isConfirmed}
            onClick={handleConfirm}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete All {totalItemsCount} Items
          </Button>
        </div>
      </div>
    </Modal>
  );
};
