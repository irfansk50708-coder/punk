// ============================================================
// Global Application Store - Zustand
// ============================================================

import { create } from 'zustand';
import type {
  Identity,
  Contact,
  Conversation,
  Message,
  Call,
  CallType,
  CallStatus,
  PeerInfo,
  RelayStats,
} from '@/lib/types';

interface AppStore {
  // Identity
  identity: Identity | null;
  setIdentity: (identity: Identity | null) => void;

  // Contacts
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  removeContact: (id: string) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;

  // Active state
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;

  // Messages per conversation
  messages: Record<string, Message[]>;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;

  // Call state
  activeCall: Call | null;
  setActiveCall: (call: Call | null) => void;
  updateCallStatus: (status: CallStatus) => void;

  // Network
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  connectedPeers: string[];
  setConnectedPeers: (peers: string[]) => void;
  peers: PeerInfo[];
  setPeers: (peers: PeerInfo[]) => void;
  addPeer: (peer: PeerInfo) => void;

  // Relay
  isRelayEnabled: boolean;
  setRelayEnabled: (enabled: boolean) => void;
  relayStats: RelayStats;
  setRelayStats: (stats: RelayStats) => void;

  // Typing indicators
  typingPeers: Record<string, boolean>;
  setTyping: (peerId: string, isTyping: boolean) => void;

  // UI
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAddContact: boolean;
  setShowAddContact: (show: boolean) => void;
  showRelayDashboard: boolean;
  setShowRelayDashboard: (show: boolean) => void;

  // Init flags
  isInitialized: boolean;
  setInitialized: (initialized: boolean) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Identity
  identity: null,
  setIdentity: (identity) => set({ identity }),

  // Contacts
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({
      contacts: [...state.contacts.filter((c) => c.id !== contact.id), contact],
    })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    })),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  // Conversations
  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  upsertConversation: (conversation) =>
    set((state) => {
      const existing = state.conversations.findIndex(
        (c) => c.id === conversation.id
      );
      if (existing !== -1) {
        const updated = [...state.conversations];
        updated[existing] = conversation;
        return { conversations: updated.sort((a, b) => b.updatedAt - a.updatedAt) };
      }
      return {
        conversations: [conversation, ...state.conversations].sort(
          (a, b) => b.updatedAt - a.updatedAt
        ),
      };
    }),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  // Active state
  activeConversationId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),

  // Messages
  messages: {},
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),
  addMessage: (message) =>
    set((state) => {
      const convoMessages = state.messages[message.conversationId] || [];
      // Avoid duplicates
      if (convoMessages.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [message.conversationId]: [...convoMessages, message].sort(
            (a, b) => a.timestamp - b.timestamp
          ),
        },
      };
    }),
  updateMessageStatus: (messageId, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convoId of Object.keys(newMessages)) {
        newMessages[convoId] = newMessages[convoId].map((m) =>
          m.id === messageId ? { ...m, status } : m
        );
      }
      return { messages: newMessages };
    }),

  // Call
  activeCall: null,
  setActiveCall: (call) => set({ activeCall: call }),
  updateCallStatus: (status) =>
    set((state) => {
      if (!state.activeCall) return state;
      return {
        activeCall: { ...state.activeCall, status },
      };
    }),

  // Network
  isOnline: false,
  setOnline: (online) => set({ isOnline: online }),
  connectedPeers: [],
  setConnectedPeers: (peers) => set({ connectedPeers: peers }),
  peers: [],
  setPeers: (peers) => set({ peers }),
  addPeer: (peer) =>
    set((state) => ({
      peers: [...state.peers.filter((p) => p.id !== peer.id), peer],
    })),

  // Relay
  isRelayEnabled: false,
  setRelayEnabled: (enabled) => set({ isRelayEnabled: enabled }),
  relayStats: {
    packetsForwarded: 0,
    bytesRelayed: 0,
    activeCircuits: 0,
    uptime: 0,
    reputationScore: 50,
  },
  setRelayStats: (stats) => set({ relayStats: stats }),

  // Typing
  typingPeers: {},
  setTyping: (peerId, isTyping) =>
    set((state) => ({
      typingPeers: { ...state.typingPeers, [peerId]: isTyping },
    })),

  // UI
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  showAddContact: false,
  setShowAddContact: (show) => set({ showAddContact: show }),
  showRelayDashboard: false,
  setShowRelayDashboard: (show) => set({ showRelayDashboard: show }),

  // Init
  isInitialized: false,
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  isLoading: true,
  setLoading: (loading) => set({ isLoading: loading }),
}));
