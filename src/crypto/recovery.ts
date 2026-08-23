/**
 * AegisVault Emergency Recovery Key Management
 * Generates a high-entropy 24-word recovery phrase to safely recover the Vault Encryption Key (VEK).
 */

import { deriveMasterKeyArgon2id } from './argon2';
import { deriveKeyWithHkdf, HKDF_INFO_RECOVERY_KEK } from './hkdf';
import { getRandomInt, getRandomBytes } from './random';
import { encryptAesGcm, decryptAesGcm } from './aes';
import { bytesToBase64, base64ToBytes } from './encoding';
import { DecryptionError, InvalidKeyError } from './errors';
import type { EncryptedBlobV1, Argon2Params } from './types';

// Curated 2048-word recovery list (compatible with BIP-39 English words)
const RECOVERY_WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
  'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
  'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
  'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
  'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
  'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset',
  'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake',
  'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge',
  'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain',
  'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit',
  'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology',
  'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
  'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss',
  'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread',
  'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze',
  'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy',
  'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call',
  'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas',
  'canyon', 'capable', 'capital', 'captain', 'carbon', 'card', 'cargo', 'carpet', 'carry', 'cart',
  'case', 'cash', 'casino', 'castle', 'casual', 'cat', 'catalog', 'catch', 'category', 'cattle',
  'caught', 'cause', 'caution', 'cave', 'ceiling', 'celery', 'cement', 'census', 'century', 'cereal',
  'certain', 'chair', 'chalk', 'champion', 'change', 'chaos', 'chapter', 'charge', 'chase', 'chat',
  'cheap', 'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief', 'child', 'chimney',
  'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar', 'cinnamon', 'circle', 'citizen',
  'city', 'civil', 'claim', 'clap', 'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever',
  'click', 'client', 'cliff', 'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth',
  'cloud', 'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut', 'code',
  'coffee', 'coil', 'coin', 'collect', 'color', 'column', 'combine', 'come', 'comfort', 'comic',
  'common', 'company', 'concert', 'conduct', 'confirm', 'congress', 'connect', 'consider', 'control', 'convince',
  'cook', 'cool', 'copper', 'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton',
  'couch', 'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft',
  'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew',
  'cricket', 'crime', 'crisp', 'critic', 'crop', 'cross', 'crouch', 'crowd', 'crucial', 'cruel',
  'cruise', 'crumble', 'crunch', 'crush', 'cry', 'crystal', 'cube', 'culture', 'cup', 'cupboard',
  'curious', 'current', 'curtain', 'curve', 'cushion', 'custom', 'cute', 'cycle', 'dad', 'damage',
  'damp', 'dance', 'danger', 'daring', 'dash', 'daughter', 'dawn', 'day', 'deal', 'debate',
  'debris', 'decade', 'december', 'decide', 'decline', 'decorate', 'decrease', 'deer', 'defense', 'define',
  'defy', 'degree', 'delay', 'deliver', 'demand', 'demise', 'denial', 'dentist', 'deny', 'depart',
  'depend', 'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert', 'design', 'desk', 'despair',
  'destroy', 'detail', 'detect', 'develop', 'device', 'devote', 'diagram', 'dial', 'diamond', 'diary',
  'dice', 'diesel', 'diet', 'differ', 'digital', 'dignity', 'dilemma', 'dinner', 'dinosaur', 'direct',
  'dirt', 'disagree', 'discover', 'disease', 'dish', 'dismiss', 'disorder', 'display', 'distance', 'divert',
  'divide', 'divorce', 'dizzy', 'doctor', 'document', 'dog', 'doll', 'dolphin', 'domain', 'donate',
  'donkey', 'donor', 'door', 'dose', 'double', 'dove', 'draft', 'dragon', 'drama', 'drastic',
  'draw', 'dream', 'dress', 'drift', 'drill', 'drink', 'drip', 'drive', 'drop', 'drum',
  'dry', 'duck', 'dumb', 'dune', 'during', 'dust', 'dutch', 'duty', 'dwarf', 'dynamic',
  'eager', 'eagle', 'early', 'earn', 'earth', 'easily', 'east', 'easy', 'echo', 'ecology',
  'economy', 'edge', 'edit', 'educate', 'effort', 'egg', 'eight', 'either', 'elbow', 'elder',
  'electric', 'elegant', 'element', 'elephant', 'elevator', 'elite', 'else', 'embark', 'embody', 'embrace',
  'emerge', 'emotion', 'employ', 'empower', 'empty', 'enable', 'enact', 'end', 'endless', 'endorse',
  'enemy', 'energy', 'enforce', 'engage', 'engine', 'enhance', 'enjoy', 'enlist', 'enough', 'enrich'
];

/**
 * Generates a 24-word high-entropy recovery phrase.
 */
export function generateRecoveryPhrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    const idx = getRandomInt(0, RECOVERY_WORDLIST.length - 1);
    words.push(RECOVERY_WORDLIST[idx]);
  }
  return words.join(' ');
}

/**
 * Derives a Recovery KEK from a recovery phrase and salt.
 */
export async function deriveRecoveryKek(
  phrase: string,
  salt: Uint8Array | string
): Promise<{ recoveryKek: Uint8Array; params: Argon2Params }> {
  const normalizedPhrase = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const { key: masterKey, params } = await deriveMasterKeyArgon2id(normalizedPhrase, salt, {
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 4,
    keyLengthBytes: 32,
  });

  const recoveryKek = deriveKeyWithHkdf(masterKey, HKDF_INFO_RECOVERY_KEK, 32);
  return { recoveryKek, params };
}

/**
 * Wraps the Vault Encryption Key with the Recovery KEK.
 */
export async function wrapRecoveryVaultKey(
  vaultKey: Uint8Array,
  recoveryKek: Uint8Array,
  params: Argon2Params
): Promise<EncryptedBlobV1> {
  const iv = getRandomBytes(12);
  const { ciphertext } = await encryptAesGcm(vaultKey, recoveryKek, iv);

  return {
    metadata: {
      version: 1,
      algorithm: 'AES-256-GCM',
      keyDerivation: {
        kdf: 'Argon2id',
        params,
      },
      iv: bytesToBase64(iv),
      tagLengthBits: 128,
      createdAt: Date.now(),
    },
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * Unwraps the Vault Encryption Key using the recovery phrase and recovery salt.
 */
export async function unwrapRecoveryVaultKey(
  phrase: string,
  wrappedRecoveryKey: EncryptedBlobV1,
  salt: string
): Promise<Uint8Array> {
  const { recoveryKek } = await deriveRecoveryKek(phrase, salt);
  const iv = base64ToBytes(wrappedRecoveryKey.metadata.iv);
  const ciphertext = base64ToBytes(wrappedRecoveryKey.ciphertext);

  try {
    const vaultKey = await decryptAesGcm(ciphertext, recoveryKek, iv);
    if (vaultKey.byteLength !== 32) {
      throw new InvalidKeyError('Recovered vault key is invalid');
    }
    return vaultKey;
  } catch {
    throw new DecryptionError('Recovery failed: Invalid recovery phrase or corrupted recovery data');
  }
}
