// ============================================================
// Cryptographic primitives using WebCrypto API
// X25519 key exchange, AES-256-GCM encryption, ECDSA signing
// Double Ratchet protocol for forward secrecy
// ============================================================

import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/utils';
import type { ExportedKeyPair } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────
const ECDH_ALGORITHM = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const NONCE_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const INFO_ENCRYPT = new TextEncoder().encode('punk-e2e-encrypt');
const INFO_RATCHET = new TextEncoder().encode('punk-ratchet');

// ─── Key Generation ──────────────────────────────────────────

/** Generate an ECDH key pair for Diffie-Hellman key exchange */
export async function generateEncryptionKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    ECDH_ALGORITHM,
    true,  // extractable
    ['deriveKey', 'deriveBits']
  );
}

/** Generate an ECDSA key pair for signing/verification */
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    ECDSA_ALGORITHM,
    true,
    ['sign', 'verify']
  );
}

/** Generate a random AES-256 symmetric key */
export async function generateSymmetricKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// ─── Key Export / Import ─────────────────────────────────────

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return btoa(JSON.stringify(jwk));
}

export async function importECDHPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'raw',
    raw,
    ECDH_ALGORITHM,
    true,
    []
  );
}

export async function importECDHPrivateKey(base64: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(base64));
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    ECDH_ALGORITHM,
    true,
    ['deriveKey', 'deriveBits']
  );
}

export async function importECDSAPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'raw',
    raw,
    ECDSA_ALGORITHM,
    true,
    ['verify']
  );
}

export async function importECDSAPrivateKey(base64: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(base64));
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    ECDSA_ALGORITHM,
    true,
    ['sign']
  );
}

export async function exportKeyPair(
  publicKey: CryptoKey,
  privateKey: CryptoKey
): Promise<ExportedKeyPair> {
  return {
    publicKey: await exportPublicKey(publicKey),
    privateKey: await exportPrivateKey(privateKey),
  };
}

export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

export async function importSymmetricKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

// ─── Key Derivation (ECDH + HKDF) ───────────────────────────

/** Derive a shared AES key from ECDH key exchange */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt?: Uint8Array,
  info: Uint8Array = INFO_ENCRYPT
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );

  // Import as HKDF base key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Use HKDF to derive AES key
  const useSalt = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(useSalt) as BufferSource,
      info: new Uint8Array(info) as BufferSource,
    },
    hkdfKey,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  return { key: aesKey, salt: useSalt };
}

// ─── AES-GCM Encryption ─────────────────────────────────────

export async function encrypt(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv: nonce },
    key,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: string,
  nonce: string
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv: base64ToArrayBuffer(nonce) },
    key,
    base64ToArrayBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

// ─── ECDSA Signing ───────────────────────────────────────────

export async function sign(
  privateKey: CryptoKey,
  data: string
): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded
  );
  return arrayBufferToBase64(signature);
}

export async function verify(
  publicKey: CryptoKey,
  data: string,
  signature: string
): Promise<boolean> {
  const encoded = new TextEncoder().encode(data);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    base64ToArrayBuffer(signature),
    encoded
  );
}

// ─── Fingerprint ─────────────────────────────────────────────

/** Generate a hex fingerprint from a public key */
export async function fingerprint(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Double Ratchet Protocol ─────────────────────────────────
// Simplified implementation of the Signal Double Ratchet for forward secrecy

export interface RatchetState {
  rootKey: CryptoKey;
  sendChainKey: CryptoKey | null;
  receiveChainKey: CryptoKey | null;
  sendRatchetKey: CryptoKeyPair;
  receiveRatchetPublic: CryptoKey | null;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  previousChainLength: number;
  skippedKeys: Map<string, CryptoKey>;
}

/** Initialize the ratchet as the initiator */
export async function initRatchetAsInitiator(
  sharedSecret: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<RatchetState> {
  const sendRatchetKey = await generateEncryptionKeyPair();

  const { key: rootKey } = await deriveSharedKey(
    sendRatchetKey.privateKey,
    recipientPublicKey,
    new Uint8Array(SALT_LENGTH),
    INFO_RATCHET
  );

  // Derive first send chain key
  const sendChainRaw = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPublicKey },
    sendRatchetKey.privateKey,
    256
  );
  const sendChainKey = await crypto.subtle.importKey(
    'raw', sendChainRaw,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign']
  );

  return {
    rootKey,
    sendChainKey,
    receiveChainKey: null,
    sendRatchetKey,
    receiveRatchetPublic: recipientPublicKey,
    sendMessageNumber: 0,
    receiveMessageNumber: 0,
    previousChainLength: 0,
    skippedKeys: new Map(),
  };
}

/** Initialize the ratchet as the responder */
export async function initRatchetAsResponder(
  sharedSecret: CryptoKey,
  ownKeyPair: CryptoKeyPair
): Promise<RatchetState> {
  return {
    rootKey: sharedSecret,
    sendChainKey: null,
    receiveChainKey: null,
    sendRatchetKey: ownKeyPair,
    receiveRatchetPublic: null,
    sendMessageNumber: 0,
    receiveMessageNumber: 0,
    previousChainLength: 0,
    skippedKeys: new Map(),
  };
}

/** Derive a message key from a chain key using HMAC */
async function deriveMessageKey(chainKey: CryptoKey): Promise<{
  messageKey: CryptoKey;
  nextChainKey: CryptoKey;
}> {
  // Message key = HMAC(chainKey, 0x01)
  const msgKeyRaw = await crypto.subtle.sign(
    'HMAC',
    chainKey,
    new Uint8Array([0x01])
  );
  const messageKey = await crypto.subtle.importKey(
    'raw',
    msgKeyRaw.slice(0, 32),
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // Next chain key = HMAC(chainKey, 0x02)
  const nextRaw = await crypto.subtle.sign(
    'HMAC',
    chainKey,
    new Uint8Array([0x02])
  );
  const nextChainKey = await crypto.subtle.importKey(
    'raw',
    nextRaw.slice(0, 32),
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign']
  );

  return { messageKey, nextChainKey };
}

/** Encrypt a message using the double ratchet */
export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: string
): Promise<{
  state: RatchetState;
  header: { publicKey: string; messageNumber: number; previousChainLength: number };
  ciphertext: string;
  nonce: string;
}> {
  if (!state.sendChainKey) {
    throw new Error('Send chain not initialized');
  }

  const { messageKey, nextChainKey } = await deriveMessageKey(state.sendChainKey);
  const { ciphertext, nonce } = await encrypt(messageKey, plaintext);

  const header = {
    publicKey: await exportPublicKey(state.sendRatchetKey.publicKey),
    messageNumber: state.sendMessageNumber,
    previousChainLength: state.previousChainLength,
  };

  return {
    state: {
      ...state,
      sendChainKey: nextChainKey,
      sendMessageNumber: state.sendMessageNumber + 1,
    },
    header,
    ciphertext,
    nonce,
  };
}

/** Decrypt a message using the double ratchet */
export async function ratchetDecrypt(
  state: RatchetState,
  header: { publicKey: string; messageNumber: number; previousChainLength: number },
  ciphertext: string,
  nonce: string
): Promise<{ state: RatchetState; plaintext: string }> {
  // Check for skipped message key
  const skippedKeyId = `${header.publicKey}:${header.messageNumber}`;
  const skippedKey = state.skippedKeys.get(skippedKeyId);
  if (skippedKey) {
    const plaintext = await decrypt(skippedKey, ciphertext, nonce);
    state.skippedKeys.delete(skippedKeyId);
    return { state, plaintext };
  }

  let newState = { ...state };

  // Perform DH ratchet if new public key
  const headerPubKey = await importECDHPublicKey(header.publicKey);
  if (!state.receiveRatchetPublic ||
      (await exportPublicKey(headerPubKey)) !== (await exportPublicKey(state.receiveRatchetPublic))) {
    // New ratchet step
    const { key: newRootKey } = await deriveSharedKey(
      state.sendRatchetKey.privateKey,
      headerPubKey,
      new Uint8Array(SALT_LENGTH),
      INFO_RATCHET
    );

    // Generate new send ratchet key pair
    const newSendRatchetKey = await generateEncryptionKeyPair();
    const receiveChainBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: headerPubKey },
      state.sendRatchetKey.privateKey,
      256
    );
    const receiveChainKey = await crypto.subtle.importKey(
      'raw', receiveChainBits.slice(0, 32),
      { name: 'HMAC', hash: 'SHA-256' },
      true, ['sign']
    );

    const sendChainBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: headerPubKey },
      newSendRatchetKey.privateKey,
      256
    );
    const sendChainKey = await crypto.subtle.importKey(
      'raw', sendChainBits.slice(0, 32),
      { name: 'HMAC', hash: 'SHA-256' },
      true, ['sign']
    );

    newState = {
      ...newState,
      rootKey: newRootKey,
      sendChainKey,
      receiveChainKey,
      sendRatchetKey: newSendRatchetKey,
      receiveRatchetPublic: headerPubKey,
      previousChainLength: newState.sendMessageNumber,
      sendMessageNumber: 0,
      receiveMessageNumber: 0,
    };
  }

  // Skip messages if needed
  if (!newState.receiveChainKey) {
    throw new Error('Receive chain not initialized');
  }

  while (newState.receiveMessageNumber < header.messageNumber) {
    const { messageKey, nextChainKey } = await deriveMessageKey(newState.receiveChainKey!);
    const skipId = `${header.publicKey}:${newState.receiveMessageNumber}`;
    newState.skippedKeys.set(skipId, messageKey);
    newState.receiveChainKey = nextChainKey;
    newState.receiveMessageNumber++;
  }

  const { messageKey, nextChainKey } = await deriveMessageKey(newState.receiveChainKey!);
  const plaintext = await decrypt(messageKey, ciphertext, nonce);

  newState.receiveChainKey = nextChainKey;
  newState.receiveMessageNumber++;

  return { state: newState, plaintext };
}

// ─── Utility: Generate random nonce ──────────────────────────
export function generateNonce(): string {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  return arrayBufferToBase64(nonce.buffer);
}

// ─── Utility: Hash data ──────────────────────────────────────
export async function sha256(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return arrayBufferToBase64(hash);
}
