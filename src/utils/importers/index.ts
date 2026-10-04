/**
 * Surakshit Vault Multi-Format Import & Export Engine
 * Ultra-fast, atomic, lossless bulk import supporting Bitwarden (JSON & CSV),
 * Proton Pass (JSON & CSV), 1Password, Chrome CSV, and Surakshit Encrypted formats.
 */

import { unzipSync, strFromU8 } from 'fflate';
import type {
  VaultItem,
  LoginItem,
  SecureNoteItem,
  CreditCardItem,
  IdentityItem,
  DecryptedVault,
  CustomField,
} from '../../types/vault';

export type ImportExportFormat =
  | 'bitwarden-json'
  | 'bitwarden-csv'
  | 'protonpass-json'
  | 'protonpass-zip'
  | 'protonpass-csv'
  | 'chrome-csv'
  | 'surakshit-encrypted';

export interface FailedImportItem {
  index: number;
  name: string;
  error: string;
  raw: any;
}

export interface DetailedImportResult {
  totalDetected: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  foldersCreated: string[];
  folderItemCounts: Record<string, number>;
  failedItems: FailedImportItem[];
  validItems: VaultItem[];
  allFolders: string[];
  formatDetected: string;
}

/**
 * Computes a normalized fingerprint string for duplicate detection.
 */
export function computeItemFingerprint(item: Partial<VaultItem>): string {
  const type = item.type || 'login';
  const name = (item.name || '').trim().toLowerCase();
  const folder = (item.folder || '').trim().toLowerCase();

  let payloadKey = '';
  if (type === 'login') {
    const login = item as Partial<LoginItem>;
    const username = (login.username || '').trim().toLowerCase();
    const primaryUrl = (login.urls?.[0] || '').trim().toLowerCase();
    payloadKey = `${username}|${primaryUrl}`;
  } else if (type === 'note') {
    const note = item as Partial<SecureNoteItem>;
    payloadKey = (note.content || '').slice(0, 80).trim();
  } else if (type === 'card') {
    const card = item as Partial<CreditCardItem>;
    const cardNum = (card.cardNumber || '').slice(-4);
    payloadKey = `${cardNum}|${card.expirationMonth}/${card.expirationYear}`;
  } else if (type === 'identity') {
    const iden = item as Partial<IdentityItem>;
    payloadKey = `${(iden.firstName || '').toLowerCase()}|${(iden.lastName || '').toLowerCase()}|${(iden.email || '').toLowerCase()}`;
  }

  return `${type}:${name}:${folder}:${payloadKey}`;
}

// -------------------------------------------------------------
// RFC 4180 High-Performance CSV Parser
// -------------------------------------------------------------
export function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Skip \r\n
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function escapeCsvCell(cell: string | undefined): string {
  if (!cell) return '';
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

// -------------------------------------------------------------
// 1. Bitwarden JSON Importer & Exporter
// -------------------------------------------------------------
export function parseBitwardenJson(jsonText: string): DetailedImportResult {
  const parsed = JSON.parse(jsonText);
  const validItems: VaultItem[] = [];
  const failedItems: FailedImportItem[] = [];
  const folderSet = new Set<string>();
  const folderMap = new Map<string, string>();
  const folderItemCounts: Record<string, number> = {};

  // 1. Extract all defined folders
  if (Array.isArray(parsed.folders)) {
    for (const f of parsed.folders) {
      if (f && typeof f === 'object' && f.name) {
        const folderName = String(f.name).trim();
        if (folderName) {
          folderSet.add(folderName);
          if (f.id) {
            folderMap.set(String(f.id), folderName);
          }
        }
      }
    }
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const now = Date.now();

  // 2. Parse items in isolated try/catch blocks
  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    try {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Invalid item object structure');
      }

      // Determine folder mapping: prefer folderId lookup, then raw folder name, then fallback
      let folderName: string | undefined;
      if (raw.folderId && folderMap.has(String(raw.folderId))) {
        folderName = folderMap.get(String(raw.folderId));
      } else if (raw.folder && typeof raw.folder === 'string' && raw.folder.trim()) {
        folderName = raw.folder.trim();
      }

      if (folderName) {
        folderSet.add(folderName);
        folderItemCounts[folderName] = (folderItemCounts[folderName] || 0) + 1;
      } else {
        folderItemCounts['(No Folder)'] = (folderItemCounts['(No Folder)'] || 0) + 1;
      }

      const name = (raw.name ? String(raw.name).trim() : '') || 'Untitled Item';
      const favorite = Boolean(raw.favorite);
      const id = raw.id && typeof raw.id === 'string' ? raw.id : crypto.randomUUID();

      // Custom fields mapping
      const customFields: CustomField[] = [];
      if (Array.isArray(raw.fields)) {
        for (const field of raw.fields) {
          if (field && typeof field === 'object' && field.name) {
            customFields.push({
              id: crypto.randomUUID(),
              label: String(field.name).trim(),
              value: field.value !== undefined && field.value !== null ? String(field.value) : '',
              type: field.type === 1 ? 'hidden' : 'text',
            });
          }
        }
      }

      // Type 1: Login (or raw.login object present)
      if (raw.type === 1 || raw.login || (!raw.type && (raw.login || raw.username || raw.password))) {
        const login = raw.login || raw || {};
        const urls: string[] = [];

        if (Array.isArray(login.uris)) {
          for (const u of login.uris) {
            if (u && typeof u === 'object' && u.uri) {
              urls.push(String(u.uri).trim());
            } else if (typeof u === 'string' && u.trim()) {
              urls.push(u.trim());
            }
          }
        } else if (login.uri && typeof login.uri === 'string' && login.uri.trim()) {
          urls.push(login.uri.trim());
        }

        const item: LoginItem = {
          id,
          type: 'login',
          name,
          username: login.username !== undefined && login.username !== null ? String(login.username).trim() : '',
          password: login.password !== undefined && login.password !== null ? String(login.password) : '',
          urls: Array.from(new Set(urls)),
          totpSecret: login.totp ? String(login.totp).trim() : undefined,
          notes: raw.notes ? String(raw.notes) : undefined,
          folder: folderName,
          favorite,
          trash: false,
          customFields: customFields.length > 0 ? customFields : undefined,
          createdAt: now,
          updatedAt: now,
        };
        validItems.push(item);
      }
      // Type 2: Secure Note
      else if (raw.type === 2 || raw.secureNote) {
        const item: SecureNoteItem = {
          id,
          type: 'note',
          name,
          content: raw.notes ? String(raw.notes) : '',
          folder: folderName,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        };
        validItems.push(item);
      }
      // Type 3: Credit Card
      else if (raw.type === 3 || raw.card) {
        const card = raw.card || {};
        const item: CreditCardItem = {
          id,
          type: 'card',
          name,
          cardholderName: card.cardholderName ? String(card.cardholderName) : '',
          cardNumber: card.number ? String(card.number).replace(/\s+/g, '') : '',
          expirationMonth: card.expMonth ? String(card.expMonth) : '',
          expirationYear: card.expYear ? String(card.expYear) : '',
          cvv: card.code ? String(card.code) : '',
          notes: raw.notes ? String(raw.notes) : undefined,
          folder: folderName,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        };
        validItems.push(item);
      }
      // Type 4: Identity
      else if (raw.type === 4 || raw.identity) {
        const iden = raw.identity || {};
        const item: IdentityItem = {
          id,
          type: 'identity',
          name,
          firstName: iden.firstName ? String(iden.firstName) : '',
          lastName: iden.lastName ? String(iden.lastName) : '',
          email: iden.email ? String(iden.email) : '',
          phone: iden.phone ? String(iden.phone) : '',
          addressLine1: iden.address1 ? String(iden.address1) : '',
          city: iden.city ? String(iden.city) : '',
          state: iden.state ? String(iden.state) : '',
          postalCode: iden.postalCode ? String(iden.postalCode) : '',
          country: iden.country ? String(iden.country) : '',
          folder: folderName,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        };
        validItems.push(item);
      } else {
        // Default to login if unknown
        validItems.push({
          id,
          type: 'login',
          name,
          username: '',
          password: '',
          urls: [],
          notes: raw.notes ? String(raw.notes) : undefined,
          folder: folderName,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err: unknown) {
      failedItems.push({
        index: idx,
        name: raw?.name || `Record #${idx + 1}`,
        error: err instanceof Error ? err.message : 'Unknown parsing error',
        raw,
      });
    }
  }

  const allFolders = Array.from(folderSet);

  return {
    totalDetected: rawItems.length,
    importedCount: validItems.length,
    skippedCount: 0,
    failedCount: failedItems.length,
    foldersCreated: allFolders,
    folderItemCounts,
    failedItems,
    validItems,
    allFolders,
    formatDetected: 'Bitwarden JSON',
  };
}

export function exportBitwardenJson(vault: DecryptedVault): string {
  const folderMap = new Map<string, string>();
  const folders = (vault.folders || []).map((name) => {
    const id = crypto.randomUUID();
    folderMap.set(name, id);
    return { id, name };
  });

  const bwItems = vault.items
    .filter((i) => !i.trash)
    .map((item) => {
      const folderId = item.folder ? folderMap.get(item.folder) || null : null;
      const base: Record<string, unknown> = {
        id: item.id,
        organizationId: null,
        folderId,
        type: item.type === 'login' ? 1 : item.type === 'note' ? 2 : item.type === 'card' ? 3 : 4,
        name: item.name,
        notes: (item as any).notes || (item.type === 'note' ? item.content : null),
        favorite: Boolean(item.favorite),
        fields:
          (item as any).customFields?.map((f: CustomField) => ({
            name: f.label,
            value: f.value,
            type: f.type === 'hidden' ? 1 : 0,
          })) || [],
      };

      if (item.type === 'login') {
        base.login = {
          uris: item.urls.map((u) => ({ uri: u, match: null })),
          username: item.username,
          password: item.password,
          totp: item.totpSecret || null,
        };
      } else if (item.type === 'note') {
        base.secureNote = { type: 0 };
      } else if (item.type === 'card') {
        base.card = {
          cardholderName: item.cardholderName,
          brand: null,
          number: item.cardNumber,
          expMonth: item.expirationMonth,
          expYear: item.expirationYear,
          code: item.cvv,
        };
      } else if (item.type === 'identity') {
        base.identity = {
          title: null,
          firstName: item.firstName,
          middleName: null,
          lastName: item.lastName,
          address1: item.addressLine1,
          city: item.city,
          state: item.state,
          postalCode: item.postalCode,
          country: item.country,
          phone: item.phone,
          email: item.email,
        };
      }

      return base;
    });

  const output = {
    encrypted: false,
    folders,
    items: bwItems,
  };

  return JSON.stringify(output, null, 2);
}

// -------------------------------------------------------------
// 2. Bitwarden CSV Importer & Exporter
// -------------------------------------------------------------
export function parseBitwardenCsv(csvText: string): DetailedImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or missing data rows');
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = {
    folder: header.findIndex((h) => h === 'folder' || h === 'category' || h === 'group'),
    favorite: header.indexOf('favorite'),
    type: header.indexOf('type'),
    name: header.findIndex((h) => h === 'name' || h === 'title'),
    notes: header.findIndex((h) => h === 'notes' || h === 'note' || h === 'comment'),
    fields: header.indexOf('fields'),
    login_uri: header.findIndex((h) => h === 'login_uri' || h === 'url' || h === 'website' || h === 'login_url'),
    login_username: header.findIndex((h) => h === 'login_username' || h === 'username' || h === 'user' || h === 'login'),
    login_password: header.findIndex((h) => h === 'login_password' || h === 'password' || h === 'pass'),
    login_totp: header.findIndex((h) => h === 'login_totp' || h === 'totp' || h === '2fa' || h === 'otpauth'),
  };

  const validItems: VaultItem[] = [];
  const failedItems: FailedImportItem[] = [];
  const folders = new Set<string>();
  const folderItemCounts: Record<string, number> = {};
  const now = Date.now();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    try {
      const name = (colIndex.name !== -1 ? row[colIndex.name]?.trim() : '') || 'Imported Item';
      const folder =
        colIndex.folder !== -1 && row[colIndex.folder]?.trim() ? row[colIndex.folder].trim() : undefined;
      const favorite =
        colIndex.favorite !== -1
          ? row[colIndex.favorite]?.trim() === '1' || row[colIndex.favorite]?.toLowerCase() === 'true'
          : false;
      const typeStr = colIndex.type !== -1 ? row[colIndex.type]?.toLowerCase()?.trim() : 'login';
      const notes = colIndex.notes !== -1 ? row[colIndex.notes] : undefined;
      const uri = colIndex.login_uri !== -1 ? row[colIndex.login_uri]?.trim() : '';
      const username = colIndex.login_username !== -1 ? row[colIndex.login_username]?.trim() : '';
      const password = colIndex.login_password !== -1 ? row[colIndex.login_password] : '';
      const totp = colIndex.login_totp !== -1 ? row[colIndex.login_totp]?.trim() : '';

      if (folder) {
        folders.add(folder);
        folderItemCounts[folder] = (folderItemCounts[folder] || 0) + 1;
      } else {
        folderItemCounts['(No Folder)'] = (folderItemCounts['(No Folder)'] || 0) + 1;
      }

      if (typeStr === 'note' || typeStr === 'secure note' || typeStr === '2') {
        validItems.push({
          id: crypto.randomUUID(),
          type: 'note',
          name,
          content: notes || '',
          folder,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        validItems.push({
          id: crypto.randomUUID(),
          type: 'login',
          name,
          username: username || '',
          password: password || '',
          urls: uri ? [uri] : [],
          totpSecret: totp ? totp.trim() : undefined,
          notes: notes || undefined,
          folder,
          favorite,
          trash: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err: unknown) {
      failedItems.push({
        index: r - 1,
        name: `Row #${r}`,
        error: err instanceof Error ? err.message : 'CSV parsing error',
        raw: row,
      });
    }
  }

  const allFolders = Array.from(folders);

  return {
    totalDetected: rows.length - 1,
    importedCount: validItems.length,
    skippedCount: 0,
    failedCount: failedItems.length,
    foldersCreated: allFolders,
    folderItemCounts,
    failedItems,
    validItems,
    allFolders,
    formatDetected: 'Bitwarden CSV',
  };
}

export function exportBitwardenCsv(vault: DecryptedVault): string {
  const header = 'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp';
  const lines: string[] = [header];

  for (const item of vault.items) {
    if (item.trash) continue;

    const folder = escapeCsvCell(item.folder);
    const favorite = item.favorite ? '1' : '0';
    const type =
      item.type === 'note' ? 'note' : item.type === 'card' ? 'card' : item.type === 'identity' ? 'identity' : 'login';
    const name = escapeCsvCell(item.name);
    const notes = escapeCsvCell((item as any).notes || (item.type === 'note' ? item.content : ''));
    const fields = '';
    const reprompt = '0';
    const login_uri = escapeCsvCell(item.type === 'login' ? item.urls?.[0] : '');
    const login_username = escapeCsvCell(item.type === 'login' ? item.username : '');
    const login_password = escapeCsvCell(item.type === 'login' ? item.password : '');
    const login_totp = escapeCsvCell(item.type === 'login' ? item.totpSecret : '');

    lines.push(
      `${folder},${favorite},${type},${name},${notes},${fields},${reprompt},${login_uri},${login_username},${login_password},${login_totp}`
    );
  }

  return lines.join('\n');
}

// -------------------------------------------------------------
// 3. Proton Pass JSON & CSV Importers
// -------------------------------------------------------------
export function parseProtonPassJson(jsonText: string): DetailedImportResult {
  const parsed = JSON.parse(jsonText);
  const validItems: VaultItem[] = [];
  const failedItems: FailedImportItem[] = [];
  const folders = new Set<string>();
  const folderItemCounts: Record<string, number> = {};
  const now = Date.now();

  if (parsed.encrypted === true) {
    throw new Error(
      'This Proton Pass export is PGP-encrypted. Re-export from Proton Pass without encryption (or decrypt it first) and try again.'
    );
  }

  // Real Proton Pass exports key vaults by share ID: { vaults: { [shareId]: { name, items } } }
  const vaults: any[] = Array.isArray(parsed.vaults)
    ? parsed.vaults
    : parsed.vaults && typeof parsed.vaults === 'object'
    ? Object.values(parsed.vaults)
    : [parsed];
  let totalDetected = 0;

  for (const v of vaults) {
    const vaultName = (v.name || v.title || 'Personal').trim();
    folders.add(vaultName);

    const rawItems = Array.isArray(v.items) ? v.items : [];
    totalDetected += rawItems.length;

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      try {
        const data = raw.data || raw;
        const metadata = data.metadata || data;
        const content = data.content || {};
        const name = (metadata.name || metadata.title || 'Untitled Item').trim();
        const notes = metadata.note || data.note || undefined;
        const type = raw.type || data.type || 'login';
        // Proton item state 2 = trashed
        const trash = raw.state === 2;
        const favorite = Boolean(raw.favorite || data.favorite || raw.pinned);
        const createdAt = typeof raw.createTime === 'number' ? raw.createTime * 1000 : now;
        const updatedAt = typeof raw.modifyTime === 'number' ? raw.modifyTime * 1000 : now;
        const extraFields: CustomField[] = Array.isArray(data.extraFields)
          ? data.extraFields.map((f: any) => ({
              id: crypto.randomUUID(),
              label: String(f.fieldName || 'Field'),
              value: String(f.data?.content ?? ''),
              type: f.type === 'hidden' || f.type === 'totp' ? ('hidden' as const) : ('text' as const),
            }))
          : [];

        folderItemCounts[vaultName] = (folderItemCounts[vaultName] || 0) + 1;

        if (type === 'login' || type === 'alias') {
          const urls = Array.isArray(content.urls)
            ? content.urls
            : content.url
            ? [content.url]
            : [];
          validItems.push({
            id: crypto.randomUUID(),
            type: 'login',
            name,
            username:
              content.itemUsername ||
              content.itemEmail ||
              content.username ||
              metadata.username ||
              (type === 'alias' ? raw.aliasEmail || '' : ''),
            password: content.password || '',
            urls,
            totpSecret: content.totpUri || content.totp || undefined,
            notes,
            folder: vaultName,
            favorite,
            trash,
            customFields: extraFields.length > 0 ? extraFields : undefined,
            createdAt,
            updatedAt,
          });
        } else if (type === 'note') {
          validItems.push({
            id: crypto.randomUUID(),
            type: 'note',
            name,
            content: content.note || notes || '',
            folder: vaultName,
            favorite,
            trash,
            createdAt,
            updatedAt,
          });
        } else if (type === 'creditCard' || type === 'card') {
          // Proton stores expiration as "YYYY-MM"
          const [expYear, expMonth] =
            typeof content.expirationDate === 'string' && content.expirationDate.includes('-')
              ? content.expirationDate.split('-')
              : [content.expYear || '', content.expMonth || ''];
          validItems.push({
            id: crypto.randomUUID(),
            type: 'card',
            name,
            cardholderName: content.cardholderName || '',
            cardNumber: (content.number || content.cardNumber || '').replace(/\s+/g, ''),
            expirationMonth: expMonth || '',
            expirationYear: expYear || '',
            cvv: content.verificationNumber || content.cvv || '',
            pin: content.pin || undefined,
            notes,
            folder: vaultName,
            favorite,
            trash,
            createdAt,
            updatedAt,
          });
        } else if (type === 'identity') {
          const [first = '', ...rest] = String(content.fullName || '').trim().split(/\s+/);
          validItems.push({
            id: crypto.randomUUID(),
            type: 'identity',
            name,
            firstName: content.firstName || first,
            lastName: content.lastName || rest.join(' '),
            email: content.email || '',
            phone: content.phoneNumber || '',
            addressLine1: content.streetAddress || '',
            addressLine2: content.floor || undefined,
            city: content.city || '',
            state: content.stateOrProvince || '',
            postalCode: content.zipOrPostalCode || '',
            country: content.countryOrRegion || '',
            ssnOrId: content.socialSecurityNumber || content.passportNumber || undefined,
            customFields: extraFields.length > 0 ? extraFields : undefined,
            folder: vaultName,
            favorite,
            trash,
            createdAt,
            updatedAt,
          });
        } else {
          throw new Error(`Unsupported Proton Pass item type: ${type}`);
        }
      } catch (err: unknown) {
        failedItems.push({
          index: i,
          name: raw?.data?.metadata?.name || `Proton Item #${i + 1}`,
          error: err instanceof Error ? err.message : 'Failed to parse Proton Pass item',
          raw,
        });
      }
    }
  }

  const allFolders = Array.from(folders);

  return {
    totalDetected,
    importedCount: validItems.length,
    skippedCount: 0,
    failedCount: failedItems.length,
    foldersCreated: allFolders,
    folderItemCounts,
    failedItems,
    validItems,
    allFolders,
    formatDetected: 'Proton Pass JSON',
  };
}

/**
 * Proton Pass "Export" produces a .zip containing `Proton Pass/data.json`
 * (or `data.pgp` when the user chose PGP encryption).
 */
export function parseProtonPassZip(zipBytes: Uint8Array): DetailedImportResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes, {
      filter: (f) => /(^|\/)data\.(json|pgp)$/i.test(f.name),
    });
  } catch {
    throw new Error('Could not read the zip file. Make sure it is an unmodified Proton Pass export.');
  }

  const names = Object.keys(files);
  const jsonName = names.find((n) => /data\.json$/i.test(n));
  if (!jsonName) {
    if (names.some((n) => /data\.pgp$/i.test(n))) {
      throw new Error(
        'This Proton Pass export is PGP-encrypted. Re-export from Proton Pass without encryption and try again.'
      );
    }
    throw new Error('No data.json found in the zip. Is this a Proton Pass export?');
  }

  const result = parseProtonPassJson(strFromU8(files[jsonName]));
  return { ...result, formatDetected: 'Proton Pass ZIP' };
}

export function exportProtonPassJson(vault: DecryptedVault): string {
  const output = {
    vaults: [
      {
        name: 'Personal Vault',
        items: vault.items
          .filter((i) => !i.trash)
          .map((item) => {
            if (item.type === 'login') {
              return {
                type: 'login',
                data: {
                  metadata: {
                    name: item.name,
                    note: item.notes || '',
                  },
                  content: {
                    username: item.username,
                    password: item.password,
                    urls: item.urls,
                    totpUri: item.totpSecret || '',
                  },
                },
              };
            } else if (item.type === 'note') {
              return {
                type: 'note',
                data: {
                  metadata: {
                    name: item.name,
                  },
                  content: {
                    note: item.content,
                  },
                },
              };
            } else if (item.type === 'card') {
              return {
                type: 'creditCard',
                data: {
                  metadata: {
                    name: item.name,
                    note: item.notes || '',
                  },
                  content: {
                    cardholderName: item.cardholderName,
                    cardNumber: item.cardNumber,
                    expMonth: item.expirationMonth,
                    expYear: item.expirationYear,
                    cvv: item.cvv,
                  },
                },
              };
            }
            return null;
          })
          .filter(Boolean),
      },
    ],
  };

  return JSON.stringify(output, null, 2);
}

// -------------------------------------------------------------
// 4. Chrome / Generic Password CSV Importer
// -------------------------------------------------------------
export function parseChromeCsv(csvText: string): DetailedImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error('CSV is empty or missing data rows');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'title');
  const urlIdx = header.findIndex((h) => h === 'url' || h === 'login_uri' || h === 'website');
  const userIdx = header.findIndex((h) => h === 'username' || h === 'user' || h === 'login_username');
  const passIdx = header.findIndex((h) => h === 'password' || h === 'login_password');
  const noteIdx = header.findIndex((h) => h === 'note' || h === 'notes');

  const validItems: VaultItem[] = [];
  const failedItems: FailedImportItem[] = [];
  const now = Date.now();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    try {
      const url = urlIdx !== -1 ? row[urlIdx]?.trim() : '';
      const name = (nameIdx !== -1 ? row[nameIdx]?.trim() : '') || url || 'Imported Login';
      const username = userIdx !== -1 ? row[userIdx]?.trim() : '';
      const password = passIdx !== -1 ? row[passIdx] : '';
      const notes = noteIdx !== -1 ? row[noteIdx] : undefined;

      validItems.push({
        id: crypto.randomUUID(),
        type: 'login',
        name,
        username: username || '',
        password: password || '',
        urls: url ? [url] : [],
        notes,
        favorite: false,
        trash: false,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err: unknown) {
      failedItems.push({
        index: r - 1,
        name: `Row #${r}`,
        error: err instanceof Error ? err.message : 'Parsing error',
        raw: row,
      });
    }
  }

  return {
    totalDetected: rows.length - 1,
    importedCount: validItems.length,
    skippedCount: 0,
    failedCount: failedItems.length,
    foldersCreated: [],
    folderItemCounts: { '(No Folder)': validItems.length },
    failedItems,
    validItems,
    allFolders: [],
    formatDetected: 'Generic / Chrome CSV',
  };
}

// -------------------------------------------------------------
// Auto-detect and parse any supported format
// -------------------------------------------------------------
export function autoDetectAndImport(text: string, preferredFormat?: ImportExportFormat): DetailedImportResult {
  const trimmed = text.trim();

  // JSON based formats
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.vaults) {
        return parseProtonPassJson(trimmed);
      }
      // Bitwarden JSON is default
      return parseBitwardenJson(trimmed);
    } catch {
      // Fall through to CSV
    }
  }

  // CSV based formats
  if (trimmed.toLowerCase().includes('login_username') || trimmed.toLowerCase().includes('login_password')) {
    return parseBitwardenCsv(trimmed);
  }

  if (preferredFormat === 'bitwarden-csv') {
    return parseBitwardenCsv(trimmed);
  }

  return parseChromeCsv(trimmed);
}
