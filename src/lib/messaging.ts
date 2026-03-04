// ============================================================
// Messaging System - Core messaging engine
// Handles E2E encrypted message sending/receiving,
// delivery confirmations, read receipts, typing indicators
// Double Ratchet for forward secrecy, onion routing
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  Message,
  MessageType,
  MessageStatus,
  EncryptedMessage,
  Conversation,
  Contact,
} from '@/lib/types';
import {
  encrypt,
  decrypt,
  sign,
  verify,
  deriveSharedKey,
  importECDHPublicKey,
  importECDHPrivateKey,
  importECDSAPrivateKey,
  importECDSAPublicKey,
  exportPublicKey,
  generateEncryptionKeyPair,
  generateNonce,
  initRatchetAsInitiator,
  initRatchetAsResponder,
  ratchetEncrypt,
  ratchetDecrypt,
  type RatchetState,
} from '@/lib/crypto';
import { getWebRTCManager } from '@/lib/webrtc';
import { getOnionRouter } from '@/lib/onion';
import {
  saveMessage,
  saveConversation,
  getConversation,
  getOrCreateDirectConversation,
  updateMessageStatus,
  getContact,
} from '@/lib/db';

type MessageHandler = (message: Message) => void;
type TypingHandler = (peerId: string, isTyping: boolean) => void;
type StatusHandler = (messageId: string, status: MessageStatus) => void;

export class MessagingEngine {
  private myId: string;
  private encryptionPrivateKey: string;
  private signingPrivateKey: string;
  private signingPublicKeyBase64: string | null = null; // cached
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private offlineQueue: Map<string, EncryptedMessage[]> = new Map();
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Double Ratchet state per peer
  private ratchetStates: Map<string, RatchetState> = new Map();

  constructor(myId: string, encryptionPrivateKey: string, signingPrivateKey: string) {
    this.myId = myId;
    this.encryptionPrivateKey = encryptionPrivateKey;
    this.signingPrivateKey = signingPrivateKey;
  }

  /** Cache our own signing public key for inclusion in messages */
  private async getSigningPublicKey(): Promise<string> {
    if (!this.signingPublicKeyBase64) {
      const privKey = await importECDSAPrivateKey(this.signingPrivateKey);
      // Re‐derive public key by exporting the JWK and re-importing as public
      const jwk = JSON.parse(atob(this.signingPrivateKey));
      // Remove private component to get public key
      const pubJwk = { ...jwk };
      delete pubJwk.d;
      pubJwk.key_ops = ['verify'];
      const pubKey = await crypto.subtle.importKey(
        'jwk',
        pubJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      this.signingPublicKeyBase64 = await exportPublicKey(pubKey);
    }
    return this.signingPublicKeyBase64;
  }

  // ─── Event Handlers ─────────────────────────────────────

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  // ─── Send Message ───────────────────────────────────────

  async sendMessage(
    recipientId: string,
    recipientPublicKey: string,
    content: string,
    type: MessageType = 'text'
  ): Promise<Message> {
    const messageId = uuidv4();

    // Create plaintext message
    const message: Message = {
      id: messageId,
      conversationId: [this.myId, recipientId].sort().join(':'),
      senderId: this.myId,
      recipientId,
      type,
      content,
      timestamp: Date.now(),
      status: 'sending',
    };

    // Save locally
    await saveMessage(message);

    // Encrypt the message
    try {
      const encrypted = await this.encryptMessage(message, recipientPublicKey);

      const payload = JSON.stringify({
        type: 'encrypted-message',
        payload: encrypted,
      });

      // Attempt onion-routed delivery first
      let sent = false;
      const onion = getOnionRouter();
      const webrtc = getWebRTCManager();

      // Look up available relays from known peers
      try {
        const peers = webrtc.getConnectedPeerIds();
        if (peers.length >= 3) {
          // We have enough peers to try onion routing
          // Build pseudo PeerInfo for circuit building
          const peerInfos = peers
            .filter((id) => id !== recipientId)
            .map((id) => ({
              id,
              publicKey: '', // relay keys resolved at circuit build
              addresses: [] as string[],
              lastSeen: Date.now(),
              reputation: 50,
              isRelay: true, // optimistic — circuit build will verify
            }));

          // Only attempt if we have relay candidates
          if (peerInfos.length >= 3) {
            const circuit = await onion.buildCircuit(peerInfos, recipientId, recipientPublicKey);
            if (circuit && circuit.path.length > 1) {
              // Multi-hop circuit available
              const packet = await onion.wrapMessage(circuit.id, payload);
              if (packet) {
                const firstHop = circuit.path[0].peerId;
                sent = webrtc.sendData(
                  firstHop,
                  JSON.stringify({ type: 'onion-packet', payload: packet })
                );
                if (sent) {
                  console.log('[Messaging] Message sent via onion circuit', circuit.id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Messaging] Onion routing failed, falling back to direct:', err);
      }

      // Fallback: send directly via WebRTC DataChannel
      if (!sent) {
        sent = webrtc.sendData(recipientId, payload);
      }

      if (sent) {
        message.status = 'sent';
      } else {
        // Queue for later delivery
        if (!this.offlineQueue.has(recipientId)) {
          this.offlineQueue.set(recipientId, []);
        }
        this.offlineQueue.get(recipientId)!.push(encrypted);
        message.status = 'sent'; // Still mark as sent (queued)
      }

      await updateMessageStatus(messageId, message.status);

      // Update conversation
      const conversation = await getOrCreateDirectConversation(this.myId, recipientId);
      conversation.lastMessage = message;
      conversation.updatedAt = Date.now();
      await saveConversation(conversation);

      return message;
    } catch (err) {
      console.error('[Messaging] Failed to send message:', err);
      message.status = 'failed';
      await updateMessageStatus(messageId, 'failed');
      throw err;
    }
  }

  // ─── Receive Message ────────────────────────────────────

  async handleIncomingMessage(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data);

      switch (parsed.type) {
        case 'encrypted-message':
          await this.processEncryptedMessage(parsed.payload);
          break;
        case 'delivery-receipt':
          this.handleDeliveryReceipt(parsed.payload);
          break;
        case 'read-receipt':
          this.handleReadReceipt(parsed.payload);
          break;
        case 'typing-indicator':
          this.handleTypingIndicator(parsed.payload);
          break;
        default:
          console.warn('[Messaging] Unknown message type:', parsed.type);
      }
    } catch (err) {
      console.error('[Messaging] Failed to handle message:', err);
    }
  }

  private async processEncryptedMessage(encrypted: EncryptedMessage): Promise<void> {
    try {
      const decrypted = await this.decryptMessage(encrypted);

      // Save to local storage
      await saveMessage(decrypted);

      // Update conversation
      const conversation = await getOrCreateDirectConversation(
        this.myId,
        decrypted.senderId
      );
      conversation.lastMessage = decrypted;
      conversation.updatedAt = Date.now();
      conversation.unreadCount += 1;
      await saveConversation(conversation);

      // Send delivery receipt
      this.sendDeliveryReceipt(decrypted.senderId, decrypted.id);

      // Notify handlers
      this.messageHandlers.forEach((handler) => handler(decrypted));
    } catch (err) {
      console.error('[Messaging] Failed to decrypt message:', err);
    }
  }

  // ─── Encryption (with Double Ratchet) ───────────────────

  private async encryptMessage(
    message: Message,
    recipientPublicKey: string
  ): Promise<EncryptedMessage> {
    const recipientKey = await importECDHPublicKey(recipientPublicKey);
    const senderSigningKey = await this.getSigningPublicKey();

    const plaintext = JSON.stringify({
      id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp,
      conversationId: message.conversationId,
    });

    let ciphertext: string;
    let nonce: string;
    let ephemeralPublicKey: string;
    let ratchetHeader: EncryptedMessage['ratchetHeader'];

    // Try Double Ratchet if we have an established session
    const ratchetState = this.ratchetStates.get(message.recipientId);
    if (ratchetState && ratchetState.sendChainKey) {
      try {
        const result = await ratchetEncrypt(ratchetState, plaintext);
        this.ratchetStates.set(message.recipientId, result.state);
        ciphertext = result.ciphertext;
        nonce = result.nonce;
        ratchetHeader = result.header;
        ephemeralPublicKey = result.header.publicKey;
      } catch (err) {
        console.warn('[Messaging] Ratchet encrypt failed, falling back to ephemeral ECDH:', err);
        // Fall through to ephemeral ECDH below
        const result = await this.ephemeralEncrypt(plaintext, recipientKey);
        ciphertext = result.ciphertext;
        nonce = result.nonce;
        ephemeralPublicKey = result.ephemeralPublicKey;
      }
    } else {
      // First message to this peer — use ephemeral ECDH and initialize ratchet
      const result = await this.ephemeralEncrypt(plaintext, recipientKey);
      ciphertext = result.ciphertext;
      nonce = result.nonce;
      ephemeralPublicKey = result.ephemeralPublicKey;

      // Initialize ratchet for future messages
      try {
        const ephPrivKey = result._ephemeralPrivateKey;
        const { key: sharedSecret } = await deriveSharedKey(ephPrivKey, recipientKey);
        const state = await initRatchetAsInitiator(sharedSecret, recipientKey);
        this.ratchetStates.set(message.recipientId, state);
      } catch (err) {
        console.warn('[Messaging] Ratchet init failed:', err);
      }
    }

    // Sign the ciphertext
    const signingKey = await importECDSAPrivateKey(this.signingPrivateKey);
    const signature = await sign(signingKey, ciphertext);

    return {
      id: message.id,
      senderId: this.myId,
      recipientId: message.recipientId,
      ciphertext,
      nonce,
      ephemeralPublicKey,
      timestamp: message.timestamp,
      signature,
      senderSigningKey,
      ratchetHeader,
    };
  }

  /** Encrypt with a one-off ephemeral ECDH key pair */
  private async ephemeralEncrypt(
    plaintext: string,
    recipientKey: CryptoKey
  ): Promise<{
    ciphertext: string;
    nonce: string;
    ephemeralPublicKey: string;
    _ephemeralPrivateKey: CryptoKey;
  }> {
    const ephemeral = await generateEncryptionKeyPair();
    const { key: sharedKey } = await deriveSharedKey(ephemeral.privateKey, recipientKey);
    const { ciphertext, nonce } = await encrypt(sharedKey, plaintext);
    return {
      ciphertext,
      nonce,
      ephemeralPublicKey: await exportPublicKey(ephemeral.publicKey),
      _ephemeralPrivateKey: ephemeral.privateKey,
    };
  }

  private async decryptMessage(encrypted: EncryptedMessage): Promise<Message> {
    // ── 1. Verify signature ────────────────────────────────
    let signatureValid = false;
    try {
      // Try to get the sender's signing key from the contact DB
      let signingPubKeyBase64 = encrypted.senderSigningKey;

      // If present in the message, cross-check against stored contact key
      const contact = await getContact(encrypted.senderId);
      if (contact?.publicKey) {
        // Prefer the stored (trusted) key if we have it
        signingPubKeyBase64 = contact.publicKey;
      }

      if (signingPubKeyBase64) {
        const signingPubKey = await importECDSAPublicKey(signingPubKeyBase64);
        signatureValid = await verify(signingPubKey, encrypted.ciphertext, encrypted.signature);
      }
    } catch (err) {
      console.warn('[Messaging] Signature verification error:', err);
    }

    if (!signatureValid) {
      console.warn(
        `[Messaging] ⚠ Signature verification FAILED for message ${encrypted.id} from ${encrypted.senderId}. ` +
        'Message may be tampered or forged.'
      );
      // We still decrypt but flag it — in production you might reject entirely
    }

    // ── 2. Decrypt content ─────────────────────────────────
    let plaintext: string;

    if (encrypted.ratchetHeader) {
      // Double Ratchet message
      let ratchetState = this.ratchetStates.get(encrypted.senderId);
      if (!ratchetState) {
        // Initialize as responder
        const myKeyPair = await this.getEncryptionKeyPair();
        const { key: sharedSecret } = await deriveSharedKey(
          myKeyPair.privateKey,
          await importECDHPublicKey(encrypted.ephemeralPublicKey)
        );
        ratchetState = await initRatchetAsResponder(sharedSecret, myKeyPair);
      }

      try {
        const result = await ratchetDecrypt(
          ratchetState,
          encrypted.ratchetHeader,
          encrypted.ciphertext,
          encrypted.nonce
        );
        this.ratchetStates.set(encrypted.senderId, result.state);
        plaintext = result.plaintext;
      } catch (err) {
        console.warn('[Messaging] Ratchet decrypt failed, trying ephemeral ECDH fallback:', err);
        plaintext = await this.ephemeralDecrypt(encrypted);
      }
    } else {
      // Ephemeral ECDH message (first message or legacy)
      plaintext = await this.ephemeralDecrypt(encrypted);

      // Initialize ratchet as responder for future messages
      try {
        const myKeyPair = await this.getEncryptionKeyPair();
        const ephPubKey = await importECDHPublicKey(encrypted.ephemeralPublicKey);
        const { key: sharedSecret } = await deriveSharedKey(myKeyPair.privateKey, ephPubKey);
        const state = await initRatchetAsResponder(sharedSecret, myKeyPair);
        this.ratchetStates.set(encrypted.senderId, state);
      } catch (err) {
        console.warn('[Messaging] Ratchet responder init failed:', err);
      }
    }

    const parsed = JSON.parse(plaintext);

    return {
      id: parsed.id,
      conversationId: parsed.conversationId || [this.myId, encrypted.senderId].sort().join(':'),
      senderId: encrypted.senderId,
      recipientId: this.myId,
      type: parsed.type || 'text',
      content: parsed.content,
      timestamp: parsed.timestamp || encrypted.timestamp,
      status: 'delivered',
      metadata: signatureValid ? { verified: true } : { verified: false },
    };
  }

  /** Decrypt using ephemeral ECDH (non-ratchet path) */
  private async ephemeralDecrypt(encrypted: EncryptedMessage): Promise<string> {
    const myPrivateKey = await importECDHPrivateKey(this.encryptionPrivateKey);
    const ephemeralPublic = await importECDHPublicKey(encrypted.ephemeralPublicKey);
    const { key: sharedKey } = await deriveSharedKey(myPrivateKey, ephemeralPublic);
    return decrypt(sharedKey, encrypted.ciphertext, encrypted.nonce);
  }

  /** Get our ECDH key pair for ratchet initialization */
  private async getEncryptionKeyPair(): Promise<CryptoKeyPair> {
    const privateKey = await importECDHPrivateKey(this.encryptionPrivateKey);
    // Derive public key from private JWK
    const jwk = JSON.parse(atob(this.encryptionPrivateKey));
    const pubJwk = { ...jwk };
    delete pubJwk.d;
    pubJwk.key_ops = [];
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      pubJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
    return { privateKey, publicKey } as CryptoKeyPair;
  }

  // ─── Receipts & Indicators ──────────────────────────────

  sendDeliveryReceipt(toPeerId: string, messageId: string): void {
    const webrtc = getWebRTCManager();
    webrtc.sendData(
      toPeerId,
      JSON.stringify({
        type: 'delivery-receipt',
        payload: { messageId, timestamp: Date.now() },
      })
    );
  }

  sendReadReceipt(toPeerId: string, messageIds: string[]): void {
    const webrtc = getWebRTCManager();
    webrtc.sendData(
      toPeerId,
      JSON.stringify({
        type: 'read-receipt',
        payload: { messageIds, timestamp: Date.now() },
      })
    );
  }

  sendTypingIndicator(toPeerId: string, isTyping: boolean): void {
    const webrtc = getWebRTCManager();
    webrtc.sendData(
      toPeerId,
      JSON.stringify({
        type: 'typing-indicator',
        payload: { isTyping, timestamp: Date.now() },
      })
    );
  }

  private handleDeliveryReceipt(payload: { messageId: string }): void {
    updateMessageStatus(payload.messageId, 'delivered');
    this.statusHandlers.forEach((handler) => handler(payload.messageId, 'delivered'));
  }

  private handleReadReceipt(payload: { messageIds: string[] }): void {
    for (const id of payload.messageIds) {
      updateMessageStatus(id, 'read');
      this.statusHandlers.forEach((handler) => handler(id, 'read'));
    }
  }

  private handleTypingIndicator(payload: { isTyping: boolean; peerId?: string }): void {
    const peerId = payload.peerId || 'unknown';
    this.typingHandlers.forEach((handler) => handler(peerId, payload.isTyping));
  }

  // ─── Offline Queue ──────────────────────────────────────

  async flushOfflineQueue(peerId: string): Promise<void> {
    const messages = this.offlineQueue.get(peerId);
    if (!messages?.length) return;

    const webrtc = getWebRTCManager();
    const remaining: EncryptedMessage[] = [];

    for (const msg of messages) {
      const sent = webrtc.sendData(
        peerId,
        JSON.stringify({
          type: 'encrypted-message',
          payload: msg,
        })
      );

      if (!sent) {
        remaining.push(msg);
      }
    }

    if (remaining.length > 0) {
      this.offlineQueue.set(peerId, remaining);
    } else {
      this.offlineQueue.delete(peerId);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────

  destroy(): void {
    this.messageHandlers.clear();
    this.typingHandlers.clear();
    this.statusHandlers.clear();
    this.typingTimers.forEach((timer) => clearTimeout(timer));
    this.typingTimers.clear();
  }
}

// Singleton
let engine: MessagingEngine | null = null;

export function getMessagingEngine(
  myId?: string,
  encPriv?: string,
  sigPriv?: string
): MessagingEngine | null {
  if (!engine && myId && encPriv && sigPriv) {
    engine = new MessagingEngine(myId, encPriv, sigPriv);
  }
  return engine;
}

export function createMessagingEngine(
  myId: string,
  encPriv: string,
  sigPriv: string
): MessagingEngine {
  if (engine) {
    engine.destroy();
  }
  engine = new MessagingEngine(myId, encPriv, sigPriv);
  return engine;
}
