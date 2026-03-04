// ============================================================
// IndexedDB Local Storage - encrypted message & contact storage
// Using idb library for Promise-based API
// ============================================================

import { openDB, type IDBPDatabase } from 'idb';
import type { Message, Contact, Conversation, Identity, GroupInfo } from '@/lib/types';

const DB_NAME = 'punk-messenger';
const DB_VERSION = 1;

interface PunkDB {
  identity: {
    key: string;
    value: Identity & { encryptionPrivateKey: string; signingPrivateKey: string };
  };
  contacts: {
    key: string;
    value: Contact;
    indexes: {
      'by-name': string;
      'by-publicKey': string;
    };
  };
  conversations: {
    key: string;
    value: Conversation;
    indexes: {
      'by-updated': number;
      'by-type': string;
    };
  };
  messages: {
    key: string;
    value: Message;
    indexes: {
      'by-conversation': string;
      'by-timestamp': number;
      'by-sender': string;
    };
  };
  groups: {
    key: string;
    value: GroupInfo;
  };
  settings: {
    key: string;
    value: unknown;
  };
}

let db: IDBPDatabase<PunkDB> | null = null;

async function getDB(): Promise<IDBPDatabase<PunkDB>> {
  if (db) return db;

  db = await openDB<PunkDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Identity store
      if (!database.objectStoreNames.contains('identity')) {
        database.createObjectStore('identity');
      }

      // Contacts store
      if (!database.objectStoreNames.contains('contacts')) {
        const contactsStore = database.createObjectStore('contacts', {
          keyPath: 'id',
        });
        contactsStore.createIndex('by-name', 'displayName');
        contactsStore.createIndex('by-publicKey', 'publicKey');
      }

      // Conversations store
      if (!database.objectStoreNames.contains('conversations')) {
        const convoStore = database.createObjectStore('conversations', {
          keyPath: 'id',
        });
        convoStore.createIndex('by-updated', 'updatedAt');
        convoStore.createIndex('by-type', 'type');
      }

      // Messages store
      if (!database.objectStoreNames.contains('messages')) {
        const msgStore = database.createObjectStore('messages', {
          keyPath: 'id',
        });
        msgStore.createIndex('by-conversation', 'conversationId');
        msgStore.createIndex('by-timestamp', 'timestamp');
        msgStore.createIndex('by-sender', 'senderId');
      }

      // Groups store
      if (!database.objectStoreNames.contains('groups')) {
        database.createObjectStore('groups', { keyPath: 'id' });
      }

      // Settings store
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings');
      }
    },
  });

  return db;
}

// ─── Identity Operations ─────────────────────────────────────

export async function saveIdentity(
  identity: Identity & { encryptionPrivateKey: string; signingPrivateKey: string }
): Promise<void> {
  const database = await getDB();
  await database.put('identity', identity, 'current');
}

export async function loadIdentity(): Promise<
  (Identity & { encryptionPrivateKey: string; signingPrivateKey: string }) | null
> {
  const database = await getDB();
  const result = await database.get('identity', 'current');
  return result || null;
}

export async function deleteIdentity(): Promise<void> {
  const database = await getDB();
  await database.delete('identity', 'current');
}

// ─── Contact Operations ──────────────────────────────────────

export async function saveContact(contact: Contact): Promise<void> {
  const database = await getDB();
  await database.put('contacts', contact);
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const database = await getDB();
  return database.get('contacts', id);
}

export async function getAllContacts(): Promise<Contact[]> {
  const database = await getDB();
  return database.getAll('contacts');
}

export async function deleteContact(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('contacts', id);
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const all = await getAllContacts();
  const lower = query.toLowerCase();
  return all.filter((c) => c.displayName.toLowerCase().includes(lower));
}

// ─── Conversation Operations ─────────────────────────────────

export async function saveConversation(conversation: Conversation): Promise<void> {
  const database = await getDB();
  await database.put('conversations', conversation);
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const database = await getDB();
  return database.get('conversations', id);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const database = await getDB();
  const all = await database.getAll('conversations');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(id: string): Promise<void> {
  const database = await getDB();
  // Delete all messages in conversation
  const messages = await getMessagesByConversation(id);
  const tx = database.transaction('messages', 'readwrite');
  for (const msg of messages) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
  // Delete conversation
  await database.delete('conversations', id);
}

export async function getOrCreateDirectConversation(
  myId: string,
  peerId: string
): Promise<Conversation> {
  const all = await getAllConversations();
  const existing = all.find(
    (c) =>
      c.type === 'direct' &&
      c.participants.includes(myId) &&
      c.participants.includes(peerId)
  );

  if (existing) return existing;

  const conversation: Conversation = {
    id: [myId, peerId].sort().join(':'),
    type: 'direct',
    participants: [myId, peerId],
    unreadCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await saveConversation(conversation);
  return conversation;
}

// ─── Message Operations ──────────────────────────────────────

export async function saveMessage(message: Message): Promise<void> {
  const database = await getDB();
  await database.put('messages', message);
}

export async function getMessage(id: string): Promise<Message | undefined> {
  const database = await getDB();
  return database.get('messages', id);
}

export async function getMessagesByConversation(
  conversationId: string,
  limit?: number
): Promise<Message[]> {
  const database = await getDB();
  const messages = await database.getAllFromIndex(
    'messages',
    'by-conversation',
    conversationId
  );
  const sorted = messages.sort((a, b) => a.timestamp - b.timestamp);
  return limit ? sorted.slice(-limit) : sorted;
}

export async function getLatestMessage(
  conversationId: string
): Promise<Message | undefined> {
  const messages = await getMessagesByConversation(conversationId, 1);
  return messages[messages.length - 1];
}

export async function updateMessageStatus(
  messageId: string,
  status: Message['status']
): Promise<void> {
  const database = await getDB();
  const message = await database.get('messages', messageId);
  if (message) {
    message.status = status;
    await database.put('messages', message);
  }
}

export async function deleteMessage(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('messages', id);
}

// ─── Group Operations ────────────────────────────────────────

export async function saveGroup(group: GroupInfo): Promise<void> {
  const database = await getDB();
  await database.put('groups', group);
}

export async function getGroup(id: string): Promise<GroupInfo | undefined> {
  const database = await getDB();
  return database.get('groups', id);
}

export async function getAllGroups(): Promise<GroupInfo[]> {
  const database = await getDB();
  return database.getAll('groups');
}

export async function deleteGroup(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('groups', id);
}

// ─── Settings Operations ─────────────────────────────────────

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const database = await getDB();
  await database.put('settings', value, key);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const database = await getDB();
  return database.get('settings', key) as Promise<T | undefined>;
}

// ─── Database Management ─────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const database = await getDB();
  const stores: Array<keyof PunkDB> = [
    'identity',
    'contacts',
    'conversations',
    'messages',
    'groups',
    'settings',
  ];

  for (const store of stores) {
    await database.clear(store);
  }
}

export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const database = await getDB();
  return {
    contacts: await database.getAll('contacts'),
    conversations: await database.getAll('conversations'),
    messages: await database.getAll('messages'),
    groups: await database.getAll('groups'),
  };
}
