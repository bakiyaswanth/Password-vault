import React, { useState } from 'react';
import {
  Key,
  FileText,
  CreditCard,
  User,
  Plus,
  Trash2,
  Sparkles,
  Star,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { PasswordGeneratorModal } from '../generator/PasswordGeneratorModal';
import type { VaultItem, ItemType, CustomField } from '../../types/vault';

export interface ItemEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: any) => Promise<void>;
  initialItem?: VaultItem | null;
  folders: string[];
}

export const ItemEditor: React.FC<ItemEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  folders,
}) => {
  const [type, setType] = useState<ItemType>(initialItem?.type || 'login');
  const [name, setName] = useState<string>(initialItem?.name || '');
  const [folder, setFolder] = useState<string>(initialItem?.folder || '');
  const [favorite, setFavorite] = useState<boolean>(initialItem?.favorite || false);
  const [tagInput, setTagInput] = useState<string>(initialItem?.tags?.join(', ') || '');

  // Login fields
  const [username, setUsername] = useState<string>(
    initialItem?.type === 'login' ? initialItem.username : ''
  );
  const [password, setPassword] = useState<string>(
    initialItem?.type === 'login' ? initialItem.password : ''
  );
  const [urlInput, setUrlInput] = useState<string>(
    initialItem?.type === 'login' ? initialItem.urls.join('\n') : ''
  );
  const [totpSecret, setTotpSecret] = useState<string>(
    initialItem?.type === 'login' ? initialItem.totpSecret || '' : ''
  );
  const [notes, setNotes] = useState<string>(
    initialItem?.type === 'login' || initialItem?.type === 'card' || initialItem?.type === 'custom'
      ? initialItem.notes || ''
      : ''
  );

  // Note fields
  const [content, setContent] = useState<string>(
    initialItem?.type === 'note' ? initialItem.content : ''
  );

  // Card fields
  const [cardholderName, setCardholderName] = useState<string>(
    initialItem?.type === 'card' ? initialItem.cardholderName : ''
  );
  const [cardNumber, setCardNumber] = useState<string>(
    initialItem?.type === 'card' ? initialItem.cardNumber : ''
  );
  const [expirationMonth, setExpirationMonth] = useState<string>(
    initialItem?.type === 'card' ? initialItem.expirationMonth : ''
  );
  const [expirationYear, setExpirationYear] = useState<string>(
    initialItem?.type === 'card' ? initialItem.expirationYear : ''
  );
  const [cvv, setCvv] = useState<string>(
    initialItem?.type === 'card' ? initialItem.cvv : ''
  );
  const [pin, setPin] = useState<string>(
    initialItem?.type === 'card' ? initialItem.pin || '' : ''
  );

  // Identity fields
  const [firstName, setFirstName] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.firstName : ''
  );
  const [lastName, setLastName] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.lastName : ''
  );
  const [idEmail, setIdEmail] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.email : ''
  );
  const [phone, setPhone] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.phone : ''
  );
  const [addressLine1, setAddressLine1] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.addressLine1 : ''
  );
  const [city, setCity] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.city : ''
  );
  const [state, setState] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.state : ''
  );
  const [postalCode, setPostalCode] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.postalCode : ''
  );
  const [country, setCountry] = useState<string>(
    initialItem?.type === 'identity' ? initialItem.country : ''
  );

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>(
    (initialItem as any)?.customFields || []
  );

  // Generator modal state
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: crypto.randomUUID(), label: '', value: '', type: 'text' },
    ]);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(customFields.filter((f) => f.id !== id));
  };

  const handleCustomFieldChange = (id: string, field: 'label' | 'value' | 'type', val: string) => {
    setCustomFields(
      customFields.map((f) => (f.id === id ? { ...f, [field]: val } : f))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item title is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const base = {
        name: name.trim(),
        folder: folder || undefined,
        favorite,
        tags: tags.length > 0 ? tags : undefined,
        trash: initialItem?.trash || false,
      };

      let itemToSave: any;

      if (type === 'login') {
        const urls = urlInput
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean);
        itemToSave = {
          ...base,
          type: 'login',
          username,
          password,
          urls,
          notes: notes || undefined,
          totpSecret: totpSecret.trim() || undefined,
          customFields: customFields.filter((f) => f.label.trim()),
        };
      } else if (type === 'note') {
        itemToSave = {
          ...base,
          type: 'note',
          content,
        };
      } else if (type === 'card') {
        itemToSave = {
          ...base,
          type: 'card',
          cardholderName,
          cardNumber: cardNumber.replace(/\s+/g, ''),
          expirationMonth,
          expirationYear,
          cvv,
          pin: pin || undefined,
          notes: notes || undefined,
        };
      } else if (type === 'identity') {
        itemToSave = {
          ...base,
          type: 'identity',
          firstName,
          lastName,
          email: idEmail,
          phone,
          addressLine1,
          city,
          state,
          postalCode,
          country,
          customFields: customFields.filter((f) => f.label.trim()),
        };
      } else {
        itemToSave = {
          ...base,
          type: 'custom',
          customFields: customFields.filter((f) => f.label.trim()),
          notes: notes || undefined,
        };
      }

      if (initialItem) {
        itemToSave.id = initialItem.id;
        itemToSave.createdAt = initialItem.createdAt;
      }

      await onSave(itemToSave);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={initialItem ? 'Edit Vault Item' : 'New Vault Item'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector (if new item) */}
          {!initialItem && (
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  type === 'login'
                    ? 'border-vault-500 bg-vault-50 dark:bg-vault-950/40 text-vault-700 dark:text-vault-300 ring-2 ring-vault-500/20'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setType('login')}
              >
                <Key className="w-5 h-5 mb-1 text-vault-600 dark:text-vault-400" />
                Login
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  type === 'note'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setType('note')}
              >
                <FileText className="w-5 h-5 mb-1 text-amber-500" />
                Secure Note
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  type === 'card'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setType('card')}
              >
                <CreditCard className="w-5 h-5 mb-1 text-emerald-500" />
                Credit Card
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                  type === 'identity'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setType('identity')}
              >
                <User className="w-5 h-5 mb-1 text-purple-500" />
                Identity
              </button>
            </div>
          )}

          {/* Primary Item Name & Favorite */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Item Name / Title"
                placeholder="e.g. Proton Mail, AWS Root, Bank of America"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => setFavorite(!favorite)}
              className={`p-2.5 rounded-lg border transition-colors ${
                favorite
                  ? 'border-amber-300 bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:border-amber-800'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600 dark:border-gray-800'
              }`}
              title="Toggle Favorite"
            >
              <Star className={`w-5 h-5 ${favorite ? 'fill-amber-500' : ''}`} />
            </button>
          </div>

          {/* Type-Specific Fields */}
          {type === 'login' && (
            <div className="space-y-3 pt-2">
              <Input
                label="Username / Email"
                placeholder="user@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <div>
                <Input
                  label="Password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isPassword
                  rightAction={
                    <button
                      type="button"
                      onClick={() => setIsGenOpen(true)}
                      className="p-1 text-vault-600 hover:text-vault-700 dark:text-vault-400"
                      title="Generate Strong Password"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Websites / URLs (one per line)
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
                  placeholder="https://github.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>

              <Input
                label="TOTP Secret / Authenticator Key"
                placeholder="e.g. JBSWY3DPEHPK3PXP or otpauth://..."
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                helperText="Client-side generated RFC 6238 two-factor code"
              />

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Encrypted Notes
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
                  placeholder="Additional confidential notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {type === 'note' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Note Content
              </label>
              <textarea
                rows={8}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
                placeholder="Write encrypted note content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
          )}

          {type === 'card' && (
            <div className="space-y-3 pt-2">
              <Input
                label="Cardholder Name"
                placeholder="Jane Doe"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
              />
              <Input
                label="Card Number"
                placeholder="4000 1234 5678 9010"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Exp Month"
                  placeholder="MM"
                  maxLength={2}
                  value={expirationMonth}
                  onChange={(e) => setExpirationMonth(e.target.value)}
                />
                <Input
                  label="Exp Year"
                  placeholder="YYYY"
                  maxLength={4}
                  value={expirationYear}
                  onChange={(e) => setExpirationYear(e.target.value)}
                />
                <Input
                  label="CVV / CVC"
                  placeholder="123"
                  maxLength={4}
                  isPassword
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                />
              </div>
              <Input
                label="PIN (Optional)"
                placeholder="4-digit PIN"
                isPassword
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
          )}

          {type === 'identity' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Email"
                  placeholder="john@example.com"
                  value={idEmail}
                  onChange={(e) => setIdEmail(e.target.value)}
                />
                <Input
                  label="Phone"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Input
                label="Address Line"
                placeholder="123 Main St"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="City"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State / Province"
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="Postal Code"
                  placeholder="ZIP"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <Input
                label="Country"
                placeholder="United States"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          )}

          {/* Folder and Tags */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Folder
              </label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-vault-500"
              >
                <option value="">(No Folder)</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Tags (comma-separated)"
              placeholder="work, personal, dev"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
          </div>

          {/* Custom Fields Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Custom Encrypted Fields
              </span>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="text-xs text-vault-600 hover:text-vault-700 dark:text-vault-400 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Field
              </button>
            </div>

            <div className="space-y-2">
              {customFields.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Label"
                    value={f.label}
                    onChange={(e) => handleCustomFieldChange(f.id, 'label', e.target.value)}
                    className="w-1/3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                  />
                  <input
                    type={f.type === 'hidden' ? 'password' : 'text'}
                    placeholder="Value"
                    value={f.value}
                    onChange={(e) => handleCustomFieldChange(f.id, 'value', e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => handleCustomFieldChange(f.id, 'type', e.target.value as any)}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                  >
                    <option value="text">Text</option>
                    <option value="hidden">Hidden</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(f.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              Save Encrypted Item
            </Button>
          </div>
        </form>
      </Modal>

      <PasswordGeneratorModal
        isOpen={isGenOpen}
        onClose={() => setIsGenOpen(false)}
        onSelectPassword={(newPass) => setPassword(newPass)}
      />
    </>
  );
};
