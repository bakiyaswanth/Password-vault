import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import type { VaultItem } from '../../types/vault';

export interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: VaultItem[];
  onConfirmDelete: (permanent: boolean) => Promise<void>;
  isTrashView?: boolean;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  onConfirmDelete,
  isTrashView = false,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const loginsCount = selectedItems.filter((i) => i.type === 'login').length;
  const notesCount = selectedItems.filter((i) => i.type === 'note').length;
  const cardsCount = selectedItems.filter((i) => i.type === 'card').length;
  const identitiesCount = selectedItems.filter((i) => i.type === 'identity').length;

  const handleConfirm = async (permanent: boolean) => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(permanent);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isTrashView ? `Permanently Delete ${selectedItems.length} Items?` : `Delete ${selectedItems.length} Selected Items?`}
      description={
        isTrashView
          ? 'These items will be permanently erased from your encrypted vault snapshot.'
          : 'Move selected items to Trash or permanently delete them.'
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Breakdown Card */}
        <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
          <span className="font-semibold text-gray-800 dark:text-gray-200 block">
            Items selected for deletion:
          </span>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-400">
            {loginsCount > 0 && <span className="px-2 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-mono">{loginsCount} Logins</span>}
            {notesCount > 0 && <span className="px-2 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-mono">{notesCount} Secure Notes</span>}
            {cardsCount > 0 && <span className="px-2 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-mono">{cardsCount} Credit Cards</span>}
            {identitiesCount > 0 && <span className="px-2 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-mono">{identitiesCount} Identities</span>}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {isTrashView
              ? 'This action is irreversible.'
              : 'Items moved to Trash can be restored anytime or permanently deleted.'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>

          {!isTrashView && (
            <Button
              variant="secondary"
              isLoading={isDeleting}
              onClick={() => handleConfirm(false)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Move to Trash
            </Button>
          )}

          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={() => handleConfirm(true)}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            {isTrashView ? 'Delete Permanently' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
