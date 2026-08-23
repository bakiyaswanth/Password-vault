/**
 * AegisVault Vault Item Types
 */

export type ItemType = 'login' | 'note' | 'card' | 'identity' | 'custom';

export interface BaseItem {
  id: string;
  type: ItemType;
  name: string;
  favorite: boolean;
  folder?: string;
  tags?: string[];
  trash: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'hidden' | 'boolean';
}

export interface LoginItem extends BaseItem {
  type: 'login';
  username: string;
  password: string;
  urls: string[];
  notes?: string;
  totpSecret?: string;
  customFields?: CustomField[];
}

export interface SecureNoteItem extends BaseItem {
  type: 'note';
  content: string;
}

export interface CreditCardItem extends BaseItem {
  type: 'card';
  cardholderName: string;
  cardNumber: string;
  expirationMonth: string;
  expirationYear: string;
  cvv: string;
  pin?: string;
  notes?: string;
}

export interface IdentityItem extends BaseItem {
  type: 'identity';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  ssnOrId?: string;
  customFields?: CustomField[];
}

export interface CustomItem extends BaseItem {
  type: 'custom';
  customFields: CustomField[];
  notes?: string;
}

export type VaultItem = LoginItem | SecureNoteItem | CreditCardItem | IdentityItem | CustomItem;

export interface DecryptedVault {
  version: number;
  items: VaultItem[];
  folders: string[];
  updatedAt: number;
}
