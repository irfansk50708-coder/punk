// ============================================================
// Core PunkNet hook - orchestrates all subsystems
// Identity, signaling, WebRTC, messaging, relay
// ============================================================

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import {
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  exportPublicKey,
  exportPrivateKey,
  fingerprint,
} from '@/lib/crypto';
import {
  loadIdentity,
  saveIdentity,
  getAllContacts,
  getAllConversations,
  getMessagesByConversation,
  saveContact,
} from '@/lib/db';
import { createSignalingClient, type SignalingClient } from '@/lib/signaling';
import { getWebRTCManager, type WebRTCManager } from '@/lib/webrtc';
import { createMessagingEngine, type MessagingEngine } from '@/lib/messaging';
import { createGroupChatManager, type GroupChatManager } from '@/lib/group';
import { getRelayManager } from '@/lib/relay';
import { getAllGroups } from '@/lib/db';
import type { Identity, SignalMessage, Contact } from '@/lib/types';

const BOOTSTRAP_URL = process.env.NEXT_PUBLIC_BOOTSTRAP_URL || 'wss://yewschat.onrender.com/api/signal';

export function usePunkNet() {
  const store = useAppStore();
  const signalingRef = useRef<SignalingClient | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const messagingRef = useRef<MessagingEngine | null>(null);
  const groupRef = useRef<GroupChatManager | null>(null);
  const initializingRef = useRef(false);

  // ─── Initialize system ────────────────────────────────────
  const initialize = useCallback(async () => {
    if (initializingRef.current || store.isInitialized) return;
    initializingRef.current = true;
    store.setLoading(true);

    try {
      // Load or create identity
      let identity = await loadIdentity();

      if (identity) {
        store.setIdentity({
          id: identity.id,
          displayName: identity.displayName,
          publicKey: identity.publicKey,
          encryptionPublicKey: identity.encryptionPublicKey,
          createdAt: identity.createdAt,
          avatar: identity.avatar,
        });

        // Initialize messaging engine
        messagingRef.current = createMessagingEngine(
          identity.id,
          identity.encryptionPrivateKey,
          identity.signingPrivateKey
        );

        // Initialize group chat manager
        groupRef.current = createGroupChatManager(
          identity.id,
          identity.displayName,
          identity.encryptionPublicKey,
          identity.signingPrivateKey,
          identity.encryptionPrivateKey,
          identity.publicKey
        );

        // Load groups
        const groups = await getAllGroups();
        await groupRef.current.loadGroups(groups);

        // Initialize signaling
        initSignaling(identity.id, identity.publicKey);

        // Load contacts & conversations
        const contacts = await getAllContacts();
        store.setContacts(contacts);

        const convos = await getAllConversations();
        store.setConversations(convos);

        // Load messages for each conversation
        for (const convo of convos) {
          const messages = await getMessagesByConversation(convo.id, 100);
          store.setMessages(convo.id, messages);
        }
      }

      store.setInitialized(true);
    } catch (err) {
      console.error('[PunkNet] Initialization failed:', err);
    } finally {
      store.setLoading(false);
      initializingRef.current = false;
    }
  }, []);

  // ─── Create Identity ──────────────────────────────────────
  const createIdentity = useCallback(async (displayName: string): Promise<Identity> => {
    // Generate key pairs
    const encKeyPair = await generateEncryptionKeyPair();
    const sigKeyPair = await generateSigningKeyPair();

    const id = await fingerprint(sigKeyPair.publicKey);
    const pubKey = await exportPublicKey(sigKeyPair.publicKey);
    const encPubKey = await exportPublicKey(encKeyPair.publicKey);
    const encPrivKey = await exportPrivateKey(encKeyPair.privateKey);
    const sigPrivKey = await exportPrivateKey(sigKeyPair.privateKey);

    const identity: Identity = {
      id,
      displayName,
      publicKey: pubKey,
      encryptionPublicKey: encPubKey,
      createdAt: Date.now(),
    };

    // Save to IndexedDB
    await saveIdentity({
      ...identity,
      encryptionPrivateKey: encPrivKey,
      signingPrivateKey: sigPrivKey,
    });

    store.setIdentity(identity);

    // Start subsystems
    messagingRef.current = createMessagingEngine(id, encPrivKey, sigPrivKey);
    groupRef.current = createGroupChatManager(id, displayName, encPubKey, sigPrivKey, encPrivKey, pubKey);
    initSignaling(id, pubKey);

    return identity;
  }, []);

  // ─── Initialize Signaling ─────────────────────────────────
  const initSignaling = useCallback((peerId: string, publicKey: string) => {
    const signaling = createSignalingClient(BOOTSTRAP_URL, peerId, publicKey);
    signalingRef.current = signaling;

    // Initialize WebRTC manager
    const webrtc = getWebRTCManager();
    webrtcRef.current = webrtc;

    // Set up signaling event handlers
    signaling.on('offer', async (data: unknown) => {
      const msg = data as SignalMessage;
      const answer = await webrtc.handleOffer(
        msg.from,
        msg.payload as RTCSessionDescriptionInit
      );
      signaling.sendAnswer(msg.from, answer);
    });

    signaling.on('answer', async (data: unknown) => {
      const msg = data as SignalMessage;
      await webrtc.handleAnswer(
        msg.from,
        msg.payload as RTCSessionDescriptionInit
      );
    });

    signaling.on('ice-candidate', async (data: unknown) => {
      const msg = data as SignalMessage;
      await webrtc.addIceCandidate(
        msg.from,
        msg.payload as RTCIceCandidateInit
      );
    });

    signaling.on('peer-discovery', (data: unknown) => {
      const msg = data as SignalMessage;
      const peerList = msg.payload as Array<{
        id: string;
        publicKey: string;
      }>;
      if (Array.isArray(peerList)) {
        for (const peer of peerList) {
          store.addPeer({
            id: peer.id,
            publicKey: peer.publicKey,
            addresses: [],
            lastSeen: Date.now(),
            reputation: 50,
            isRelay: false,
          });
        }
      }
    });

    // WebRTC event handlers
    webrtc.on('peer-connected', (event) => {
      store.setConnectedPeers(webrtc.getConnectedPeerIds());
      store.updateContact(event.peerId, { isOnline: true, lastSeen: Date.now() });

      // Flush offline messages
      messagingRef.current?.flushOfflineQueue(event.peerId);
    });

    webrtc.on('peer-disconnected', (event) => {
      store.setConnectedPeers(webrtc.getConnectedPeerIds());
      store.updateContact(event.peerId, { isOnline: false, lastSeen: Date.now() });
    });

    webrtc.on('data-message', (event) => {
      if (typeof event.data === 'string') {
        messagingRef.current?.handleIncomingMessage(event.data);
        // Also try to handle as group message
        groupRef.current?.handleIncomingMessage(event.data);
      }
    });

    webrtc.on('ice-candidate', (event) => {
      const candidate = event.data as RTCIceCandidateInit;
      signaling.sendIceCandidate(event.peerId, candidate);
    });

    // Set up messaging handlers
    if (messagingRef.current) {
      messagingRef.current.onMessage((message) => {
        store.addMessage(message);
        // Update conversation
        const convo = store.conversations.find(
          (c) => c.id === message.conversationId
        );
        if (convo) {
          store.upsertConversation({
            ...convo,
            lastMessage: message,
            updatedAt: Date.now(),
            unreadCount:
              store.activeConversationId === convo.id
                ? 0
                : convo.unreadCount + 1,
          });
        }
      });

      messagingRef.current.onTyping((peerId, isTyping) => {
        store.setTyping(peerId, isTyping);
      });

      messagingRef.current.onStatus((messageId, status) => {
        store.updateMessageStatus(messageId, status);
      });
    }

    // Connect to bootstrap
    signaling.connect();
    store.setOnline(true);

    // Set up group chat handlers
    if (groupRef.current) {
      groupRef.current.onMessage((message) => {
        store.addMessage(message);
        const convo = store.conversations.find((c) => c.id === message.conversationId);
        if (convo) {
          store.upsertConversation({
            ...convo,
            lastMessage: message,
            updatedAt: Date.now(),
            unreadCount:
              store.activeConversationId === convo.id ? 0 : convo.unreadCount + 1,
          });
        }
      });

      groupRef.current.onGroupUpdate((group) => {
        const convo = store.conversations.find((c) => c.id === group.id);
        if (convo) {
          store.upsertConversation({
            ...convo,
            name: group.name,
            participants: group.members.map((m) => m.id),
            updatedAt: Date.now(),
          });
        } else {
          store.upsertConversation({
            id: group.id,
            type: 'group',
            participants: group.members.map((m) => m.id),
            name: group.name,
            unreadCount: 0,
            createdAt: group.createdAt,
            updatedAt: Date.now(),
            groupKey: group.groupKey,
          });
        }
      });
    }
  }, []);

  // ─── Send Message ─────────────────────────────────────────
  const sendMessage = useCallback(
    async (recipientId: string, content: string) => {
      if (!messagingRef.current) return null;

      const contact = store.contacts.find((c) => c.id === recipientId);
      if (!contact) return null;

      try {
        const message = await messagingRef.current.sendMessage(
          recipientId,
          contact.encryptionPublicKey,
          content
        );
        store.addMessage(message);
        return message;
      } catch (err) {
        console.error('[PunkNet] Failed to send message:', err);
        return null;
      }
    },
    []
  );

  // ─── Connect to Peer ─────────────────────────────────────
  const connectToPeer = useCallback(async (peerId: string) => {
    if (!webrtcRef.current || !signalingRef.current) return;

    const offer = await webrtcRef.current.createOffer(peerId);
    signalingRef.current.sendOffer(peerId, offer);
  }, []);

  // ─── Add Contact ──────────────────────────────────────────
  const addContact = useCallback(
    async (contactData: {
      id: string;
      displayName: string;
      publicKey: string;
      encryptionPublicKey: string;
    }) => {
      const contact: Contact = {
        ...contactData,
        addedAt: Date.now(),
        verified: false,
      };

      await saveContact(contact);
      store.addContact(contact);

      // Try to connect
      await connectToPeer(contact.id);

      return contact;
    },
    [connectToPeer]
  );

  // ─── Voice/Video Call ─────────────────────────────────────
  const startCall = useCallback(
    async (peerId: string, type: 'voice' | 'video') => {
      if (!webrtcRef.current || !signalingRef.current || !store.identity) return;

      const stream =
        type === 'video'
          ? await webrtcRef.current.startVideoCall(peerId)
          : await webrtcRef.current.startVoiceCall(peerId);

      if (!stream) return;

      const call = {
        id: `call-${Date.now()}`,
        type,
        callerId: store.identity.id,
        receiverId: peerId,
        status: 'ringing' as const,
        startedAt: Date.now(),
      };

      store.setActiveCall(call);

      // Send call offer
      const offer = await webrtcRef.current.createOffer(peerId);
      signalingRef.current.sendSignal(peerId, 'call-offer', {
        offer,
        callType: type,
        callId: call.id,
      });
    },
    []
  );

  const endCall = useCallback(() => {
    if (!store.activeCall || !webrtcRef.current || !signalingRef.current) return;

    webrtcRef.current.endCall(store.activeCall.receiverId);
    signalingRef.current.sendSignal(
      store.activeCall.receiverId,
      'call-end',
      { callId: store.activeCall.id }
    );

    store.setActiveCall(null);
  }, []);

  // ─── Relay Node Toggle ────────────────────────────────────
  const toggleRelay = useCallback((enabled: boolean) => {
    const relay = getRelayManager();
    if (enabled) {
      relay.enable();
    } else {
      relay.disable();
    }
    store.setRelayEnabled(enabled);
  }, []);

  // ─── Typing Indicator ─────────────────────────────────────
  const sendTyping = useCallback((recipientId: string, isTyping: boolean) => {
    messagingRef.current?.sendTypingIndicator(recipientId, isTyping);
  }, []);

  // ─── Group Chat ───────────────────────────────────────────
  const createGroup = useCallback(
    async (name: string, description: string, members: Contact[]) => {
      if (!groupRef.current) return null;

      const group = await groupRef.current.createGroup(
        name,
        description,
        members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          publicKey: m.encryptionPublicKey,
          signingPublicKey: m.publicKey,
        }))
      );

      // Create conversation in store
      store.upsertConversation({
        id: group.id,
        type: 'group',
        participants: group.members.map((m) => m.id),
        name: group.name,
        unreadCount: 0,
        createdAt: group.createdAt,
        updatedAt: Date.now(),
        groupKey: group.groupKey,
      });

      return group;
    },
    []
  );

  const sendGroupMessage = useCallback(
    async (groupId: string, content: string) => {
      if (!groupRef.current) return null;
      try {
        const message = await groupRef.current.sendGroupMessage(groupId, content);
        if (message) {
          store.addMessage(message);
        }
        return message;
      } catch (err) {
        console.error('[PunkNet] Failed to send group message:', err);
        return null;
      }
    },
    []
  );

  // ─── Short Code Sharing ───────────────────────────────
  const registerShareCode = useCallback(async (): Promise<string | null> => {
    if (!signalingRef.current || !store.identity) return null;
    try {
      const code = await signalingRef.current.registerShareCode({
        id: store.identity.id,
        displayName: store.identity.displayName,
        publicKey: store.identity.publicKey,
        encryptionPublicKey: store.identity.encryptionPublicKey,
      });
      return code;
    } catch (err) {
      console.error('[PunkNet] Failed to register share code:', err);
      return null;
    }
  }, []);

  const lookupShareCode = useCallback(async (code: string) => {
    if (!signalingRef.current) return null;
    try {
      const result = await signalingRef.current.lookupShareCode(code);
      if (result.found && result.id && result.publicKey && result.encryptionPublicKey) {
        return {
          id: result.id,
          displayName: result.displayName || 'Unknown',
          publicKey: result.publicKey,
          encryptionPublicKey: result.encryptionPublicKey,
        };
      }
      return null;
    } catch (err) {
      console.error('[PunkNet] Failed to lookup share code:', err);
      return null;
    }
  }, []);

  // ─── Initialize on mount ──────────────────────────────────
  useEffect(() => {
    initialize();

    return () => {
      signalingRef.current?.disconnect();
      webrtcRef.current?.disconnectAll();
      messagingRef.current?.destroy();
      groupRef.current?.destroy();
    };
  }, [initialize]);

  return {
    identity: store.identity,
    contacts: store.contacts,
    conversations: store.conversations,
    messages: store.messages,
    activeConversationId: store.activeConversationId,
    activeCall: store.activeCall,
    isOnline: store.isOnline,
    isInitialized: store.isInitialized,
    isLoading: store.isLoading,
    connectedPeers: store.connectedPeers,
    typingPeers: store.typingPeers,
    isRelayEnabled: store.isRelayEnabled,
    relayStats: store.relayStats,

    createIdentity,
    addContact,
    sendMessage,
    connectToPeer,
    startCall,
    endCall,
    toggleRelay,
    sendTyping,
    createGroup,
    sendGroupMessage,
    registerShareCode,
    lookupShareCode,

    setActiveConversation: store.setActiveConversation,
    setShowSettings: store.setShowSettings,
    setShowAddContact: store.setShowAddContact,
    setShowRelayDashboard: store.setShowRelayDashboard,
    showSettings: store.showSettings,
    showAddContact: store.showAddContact,
    showRelayDashboard: store.showRelayDashboard,
  };
}
