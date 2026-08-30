import React, { useState, useEffect } from 'react';
import {
  Key,
  FileText,
  CreditCard,
  User,
  Star,
  Edit2,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  RotateCcw,
  Folder,
  Tag,
  Shield,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { TotpDisplay } from '../totp/TotpDisplay';
import { useClipboard } from '../../hooks/useClipboard';
import type { VaultItem } from '../../types/vault';

export interface ItemDetailProps {
  item: VaultItem | null;
  onEdit: (item: VaultItem) => void;
  onDelete: (id: string, permanent?: boolean) => void;
  onRestore: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ItemDetail: React.FC<ItemDetailProps> = ({
  item,
  onEdit,
  onDelete,
  onRestore,
  onToggleFavorite,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const { copyToClipboard, isCopied, secondsLeft, resetVisualState } = useClipboard(30);

  // Clean slate reset whenever selected item ID changes or item is deselected
  useEffect(() => {
    setShowPassword(false);
    setShowCvv(false);
    setShowPin(false);
    resetVisualState();
  }, [item?.id, resetVisualState]);

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-gray-900/30">
        <div className="w-16 h-16 rounded-2xl bg-vault-100 dark:bg-vault-950/60 flex items-center justify-center text-vault-600 dark:text-vault-400 mb-4 shadow-sm">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
          No Item Selected
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
          Select an encrypted vault item from the list on the left to view details, copy credentials, or generate TOTP codes.
        </p>
      </div>
    );
  }

  const getItemIcon = () => {
    switch (item.type) {
      case 'login':
        return <Key className="w-6 h-6 text-vault-600 dark:text-vault-400" />;
      case 'note':
        return <FileText className="w-6 h-6 text-amber-500" />;
      case 'card':
        return <CreditCard className="w-6 h-6 text-emerald-500" />;
      case 'identity':
        return <User className="w-6 h-6 text-purple-500" />;
      default:
        return <Shield className="w-6 h-6 text-gray-500" />;
    }
  };

  const formattedDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Item-scoped copy identifiers to guarantee zero cross-item state leakage
  const usernameKey = `${item.id}:username`;
  const passwordKey = `${item.id}:password`;
  const notesKey = `${item.id}:notes`;
  const cardNumKey = `${item.id}:card-number`;
  const cvvKey = `${item.id}:cvv`;
  const pinKey = `${item.id}:pin`;

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-start justify-between pb-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
            {getItemIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{item.name}</h2>
              <button
                type="button"
                onClick={() => onToggleFavorite(item.id)}
                className="text-gray-400 hover:text-amber-500 transition-colors"
                title="Toggle Favorite"
              >
                <Star
                  className={`w-5 h-5 ${
                    item.favorite ? 'fill-amber-500 text-amber-500' : ''
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="blue" size="sm">
                {item.type.toUpperCase()}
              </Badge>
              {item.folder && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Folder className="w-3 h-3 text-vault-600" />
                  {item.folder}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {item.trash ? (
            <>
              <Button
                variant="shield"
                size="sm"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={() => onRestore(item.id)}
              >
                Restore
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => onDelete(item.id, true)}
              >
                Delete Permanently
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 className="w-4 h-4" />}
                onClick={() => onEdit(item)}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => onDelete(item.id, false)}
                title="Move to Trash"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Active Clipboard Notice (Scoped to active item) */}
      {secondsLeft > 0 && (
        <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Copied to clipboard! Auto-clearing in {secondsLeft}s.</span>
          </div>
          <span className="font-mono font-semibold">{secondsLeft}s remaining</span>
        </div>
      )}

      {/* Item Body Content */}
      <div className="mt-6 space-y-6">
        {/* LOGIN ITEM */}
        {item.type === 'login' && (
          <div className="space-y-4">
            {/* Click-to-Copy Username Field */}
            {item.username && (
              <div
                onClick={() => copyToClipboard(item.username, usernameKey)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between select-none ${
                  isCopied(usernameKey)
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-sm'
                    : 'bg-gray-50/80 dark:bg-gray-800/50 border-gray-200/80 dark:border-gray-800 hover:border-vault-400 dark:hover:border-vault-600 hover:bg-white dark:hover:bg-gray-800/80 hover:shadow-sm'
                }`}
                title="Click anywhere to copy username"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                      Username / Email
                    </span>
                    {isCopied(usernameKey) ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider animate-fade-in">
                        ✓ Copied to clipboard
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Click to copy
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 block truncate mt-0.5 font-mono select-none">
                    {item.username}
                  </span>
                </div>

                <div className="p-2 text-gray-400 group-hover:text-vault-600 dark:group-hover:text-vault-400 rounded-lg group-hover:bg-vault-50 dark:group-hover:bg-vault-950/40 transition-colors shrink-0">
                  {isCopied(usernameKey) ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </div>
              </div>
            )}

            {/* Click-to-Copy Password Field */}
            {item.password && (
              <div
                onClick={() => copyToClipboard(item.password, passwordKey)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-center justify-between select-none ${
                  isCopied(passwordKey)
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 shadow-sm'
                    : 'bg-gray-50/80 dark:bg-gray-800/50 border-gray-200/80 dark:border-gray-800 hover:border-vault-400 dark:hover:border-vault-600 hover:bg-white dark:hover:bg-gray-800/80 hover:shadow-sm'
                }`}
                title="Click anywhere to copy password"
              >
                <div className="flex-1 pr-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                      Password
                    </span>
                    {isCopied(passwordKey) ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider animate-fade-in">
                        ✓ Copied to clipboard
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        Click to copy
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100 block truncate mt-0.5 select-none">
                    {showPassword ? item.password : '••••••••••••••••••••'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Password Reveal Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPassword(!showPassword);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors"
                    title={showPassword ? 'Hide Password' : 'Reveal Password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <div className="p-2 text-gray-400 group-hover:text-vault-600 dark:group-hover:text-vault-400 rounded-lg group-hover:bg-vault-50 dark:group-hover:bg-vault-950/40 transition-colors">
                    {isCopied(passwordKey) ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TOTP Display */}
            {item.totpSecret && <TotpDisplay secret={item.totpSecret} label={item.name} />}

            {/* Websites */}
            {item.urls && item.urls.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                  Websites
                </span>
                {item.urls.map((u, idx) => {
                  const urlKey = `${item.id}:url-${idx}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => copyToClipboard(u, urlKey)}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-400 hover:bg-white dark:hover:bg-gray-800 transition-all group select-none"
                      title="Click to copy URL"
                    >
                      <span className="font-mono text-gray-700 dark:text-gray-300 truncate max-w-md select-none">
                        {u}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="p-1 text-gray-400 group-hover:text-vault-600">
                          {isCopied(urlKey) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <a
                          href={u.startsWith('http') ? u : `https://${u}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-vault-600 hover:text-vault-700 dark:text-vault-400 rounded"
                          title="Open Website in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Encrypted Notes */}
            {item.notes && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                    Encrypted Notes
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.notes || '', notesKey)}
                    className="text-xs text-vault-600 hover:text-vault-700 dark:text-vault-400 flex items-center gap-1 font-medium"
                  >
                    {isCopied(notesKey) ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy Notes
                  </button>
                </div>
                <div
                  onClick={() => copyToClipboard(item.notes || '', notesKey)}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono cursor-pointer hover:border-vault-300 transition-colors"
                  title="Click to copy notes"
                >
                  {item.notes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECURE NOTE ITEM */}
        {item.type === 'note' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Encrypted Markdown Content
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(item.content, notesKey)}
                className="text-xs text-vault-600 hover:text-vault-700 dark:text-vault-400 flex items-center gap-1 font-medium"
              >
                {isCopied(notesKey) ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                Copy Note
              </button>
            </div>
            <div
              onClick={() => copyToClipboard(item.content, notesKey)}
              className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono leading-relaxed select-text cursor-pointer hover:border-vault-300 transition-colors"
              title="Click anywhere to copy note"
            >
              {item.content}
            </div>
          </div>
        )}

        {/* CREDIT CARD ITEM */}
        {item.type === 'card' && (
          <div className="space-y-4">
            <div
              onClick={() => copyToClipboard(item.cardNumber, cardNumKey)}
              className="p-6 rounded-2xl bg-gradient-to-br from-vault-800 to-vault-950 text-white shadow-lg space-y-6 cursor-pointer hover:ring-2 hover:ring-vault-400 transition-all group select-none"
              title="Click to copy card number"
            >
              <div className="flex items-center justify-between">
                <CreditCard className="w-8 h-8 text-vault-300" />
                <span className="font-mono text-xs uppercase tracking-widest text-vault-300 flex items-center gap-1">
                  {isCopied(cardNumKey) ? (
                    <span className="text-emerald-400 font-bold">✓ Copied</span>
                  ) : (
                    'Click to Copy'
                  )}
                </span>
              </div>
              <div className="font-mono text-xl tracking-widest font-semibold select-none">
                {item.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
              </div>
              <div className="flex items-end justify-between text-xs select-none">
                <div>
                  <span className="text-[10px] text-vault-400 block uppercase">Cardholder</span>
                  <span className="font-medium tracking-wide">{item.cardholderName || 'JANE DOE'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-vault-400 block uppercase">Expires</span>
                  <span className="font-mono font-medium">
                    {item.expirationMonth}/{item.expirationYear}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => copyToClipboard(item.cvv, cvvKey)}
                className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:border-vault-300 transition-all select-none"
                title="Click to copy CVV"
              >
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                    CVV / CVC
                  </span>
                  <span className="font-mono text-sm font-semibold select-none">
                    {showCvv ? item.cvv : '•••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCvv(!showCvv);
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                  >
                    {showCvv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <div className="p-1.5 text-gray-400">
                    {isCopied(cvvKey) ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {item.pin && (
                <div
                  onClick={() => copyToClipboard(item.pin!, pinKey)}
                  className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:border-vault-300 transition-all select-none"
                  title="Click to copy PIN"
                >
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">
                      PIN
                    </span>
                    <span className="font-mono text-sm font-semibold select-none">
                      {showPin ? item.pin : '••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPin(!showPin);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <div className="p-1.5 text-gray-400">
                      {isCopied(pinKey) ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IDENTITY ITEM */}
        {item.type === 'identity' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => copyToClipboard(`${item.firstName} ${item.lastName}`, `${item.id}:name`)}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-300 transition-all flex items-center justify-between select-none"
                title="Click to copy full name"
              >
                <div>
                  <span className="text-gray-400 block">Full Name</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 select-none">
                    {item.firstName} {item.lastName}
                  </span>
                </div>
                {isCopied(`${item.id}:name`) && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>

              <div
                onClick={() => copyToClipboard(item.email, `${item.id}:email`)}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-300 transition-all flex items-center justify-between select-none"
                title="Click to copy email"
              >
                <div>
                  <span className="text-gray-400 block">Email</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 select-none">{item.email}</span>
                </div>
                {isCopied(`${item.id}:email`) && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>

              <div
                onClick={() => copyToClipboard(item.phone || '', `${item.id}:phone`)}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-300 transition-all flex items-center justify-between select-none"
                title="Click to copy phone"
              >
                <div>
                  <span className="text-gray-400 block">Phone</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 select-none">{item.phone || '—'}</span>
                </div>
                {isCopied(`${item.id}:phone`) && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>

              <div
                onClick={() => copyToClipboard(`${item.city || ''}, ${item.country || ''}`, `${item.id}:city`)}
                className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-300 transition-all flex items-center justify-between select-none"
                title="Click to copy location"
              >
                <div>
                  <span className="text-gray-400 block">City, Country</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 select-none">
                    {item.city || '—'}, {item.country || '—'}
                  </span>
                </div>
                {isCopied(`${item.id}:city`) && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {(item as any).customFields && (item as any).customFields.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
              Custom Encrypted Fields
            </span>
            <div className="space-y-2">
              {(item as any).customFields.map((f: any) => {
                const fieldKey = `${item.id}:custom-${f.id}`;
                return (
                  <div
                    key={f.id}
                    onClick={() => copyToClipboard(f.value, fieldKey)}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs cursor-pointer hover:border-vault-300 transition-all select-none"
                    title="Click to copy value"
                  >
                    <div>
                      <span className="text-gray-400 block">{f.label}</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100 select-none">
                        {f.value}
                      </span>
                    </div>
                    <div className="p-1.5 text-gray-400">
                      {isCopied(fieldKey) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            {item.tags.map((tag, idx) => (
              <Badge key={idx} variant="gray" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <span>Created: {formattedDate(item.createdAt)}</span>
          <span>Updated: {formattedDate(item.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
};
