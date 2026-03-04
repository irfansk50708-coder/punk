// ============================================================
// Messaging System - Core messaging engine
// Handles E2E encrypted message sending/receiving,
// delivery confirmations, read receipts, typing indicators
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
} from '@/lib/crypto';
import { getWebRTCManager } from '@/lib/webrtc';
import { getOnionRouter } from '@/lib/onion';
import {
  saveMessage,
  saveConversation,
  getConversation,
  getOrCreateDirectConversation,
  updateMessageStatus,
} from '@/lib/db';

type MessageHandler = (message: Message) => void;
type TypingHandler = (peerId: string, isTyping: boolean) => void;
type StatusHandler = (messageId: string, status: MessageStatus) => void;

export class MessagingEngine {
  private myId: string;
  private encryptionPrivateKey: string;
  private signingPrivateKey: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private offlineQueue: Map<string, EncryptedMessage[]> = new Map();
  private typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(myId: string, encryptionPrivateKey: string, signingPrivateKey: string) {
    this.myId = myId;
    this.encryptionPrivateKey = encryptionPrivateKey;
    this.signingPrivateKey = signingPrivateKey;
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

      // Try to send via WebRTC DataChannel first
      const webrtc = getWebRTCManager();
      const sent = webrtc.sendData(
        recipientId,
        JSON.stringify({
          type: 'encrypted-message',
          payload: encrypted,
        })
      );

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

  // ─── Encryption ─────────────────────────────────────────

  private async encryptMessage(
    message: Message,
    recipientPublicKey: string
  ): Promise<EncryptedMessage> {
    // Generate ephemeral key pair for this message
    const ephemeral = await generateEncryptionKeyPair();
    const recipientKey = await importECDHPublicKey(recipientPublicKey);

    // Derive shared secret
    const { key: sharedKey } = await deriveSharedKey(
      ephemeral.privateKey,
      recipientKey
    );

    // Encrypt content
    const plaintext = JSON.stringify({
      id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp,
      conversationId: message.conversationId,
    });

    const { ciphertext, nonce } = await encrypt(sharedKey, plaintext);

    // Sign the ciphertext
    const signingKey = await importECDSAPrivateKey(this.signingPrivateKey);
    const signature = await sign(signingKey, ciphertext);

    return {
      id: message.id,
      senderId: this.myId,
      recipientId: message.recipientId,
      ciphertext,
      nonce,
      ephemeralPublicKey: await exportPublicKey(ephemeral.publicKey),
      timestamp: message.timestamp,
      signature,
    };
  }

  private async decryptMessage(encrypted: EncryptedMessage): Promise<Message> {
    // Import our private key
    const myPrivateKey = await importECDHPrivateKey(this.encryptionPrivateKey);
    const ephemeralPublic = await importECDHPublicKey(encrypted.ephemeralPublicKey);

    // Derive shared secret
    const { key: sharedKey } = await deriveSharedKey(myPrivateKey, ephemeralPublic);

    // Decrypt
    const plaintext = await decrypt(sharedKey, encrypted.ciphertext, encrypted.nonce);
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
    };
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
