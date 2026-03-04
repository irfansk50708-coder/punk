// ============================================================
// Core type definitions for the decentralized communication platform
// ============================================================

// ─── Identity & Keys ─────────────────────────────────────────
export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface ExportedKeyPair {
  publicKey: string;   // base64
  privateKey: string;  // base64
}

export interface Identity {
  id: string;            // hex fingerprint of public key
  displayName: string;
  publicKey: string;     // base64 exported public signing key
  encryptionPublicKey: string; // base64 exported X25519 public key
  createdAt: number;
  avatar?: string;
}

// ─── Contacts ────────────────────────────────────────────────
export interface Contact {
  id: string;
  displayName: string;
  publicKey: string;
  encryptionPublicKey: string;
  addedAt: number;
  lastSeen?: number;
  isOnline?: boolean;
  avatar?: string;
  verified: boolean;
}

// ─── Messages ────────────────────────────────────────────────
export type MessageType = 'text' | 'file' | 'image' | 'audio' | 'video' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  type: MessageType;
  content: string;
  timestamp: number;
  status: MessageStatus;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface EncryptedMessage {
  id: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;      // base64 encrypted content
  nonce: string;            // base64 nonce/IV
  ephemeralPublicKey: string; // base64
  timestamp: number;
  signature: string;        // base64 message signature
  senderSigningKey?: string; // base64 ECDSA public key for verification
  ratchetHeader?: {          // present when using Double Ratchet
    publicKey: string;
    messageNumber: number;
    previousChainLength: number;
  };
}

// ─── Conversations ───────────────────────────────────────────
export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];   // peer IDs
  name?: string;            // for groups
  lastMessage?: Message;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
  groupKey?: string;        // base64 symmetric group key
}

// ─── Call types ──────────────────────────────────────────────
export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'connecting' | 'connected' | 'ended' | 'missed' | 'rejected';

export interface Call {
  id: string;
  type: CallType;
  callerId: string;
  receiverId: string;
  status: CallStatus;
  startedAt: number;
  endedAt?: number;
  duration?: number;
}

// ─── Peer Network ────────────────────────────────────────────
export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

export interface PeerInfo {
  id: string;
  publicKey: string;
  addresses: string[];      // multiaddr style
  lastSeen: number;
  reputation: number;
  isRelay: boolean;
  latency?: number;
}

export interface PeerConnection {
  peerId: string;
  status: PeerStatus;
  connection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  mediaStream?: MediaStream;
}

// ─── DHT ─────────────────────────────────────────────────────
export interface DHTEntry {
  key: string;
  value: string;
  publisher: string;
  timestamp: number;
  ttl: number;
  signature: string;
}

export interface RoutingEntry {
  peerId: string;
  distance: number;
  lastSeen: number;
  latency: number;
}

// ─── Onion Routing ───────────────────────────────────────────
export interface OnionLayer {
  nextHop: string;            // peer ID of next relay
  encryptedPayload: string;   // base64 encrypted inner packet
  nonce: string;              // base64 nonce
}

export interface OnionPacket {
  circuitId: string;
  layer: string;              // base64 encrypted onion layer
  ttl: number;
}

export interface CircuitNode {
  peerId: string;
  publicKey: string;
  sharedSecret?: CryptoKey;
}

export interface OnionCircuit {
  id: string;
  path: CircuitNode[];
  createdAt: number;
  expiresAt: number;
}

// ─── Relay Nodes ─────────────────────────────────────────────
export interface RelayNode {
  id: string;
  publicKey: string;
  address: string;
  bandwidth: number;          // KB/s
  uptime: number;             // seconds
  reputation: number;         // 0-100
  connections: number;
  maxConnections: number;
  isActive: boolean;
}

export interface RelayStats {
  packetsForwarded: number;
  bytesRelayed: number;
  activeCircuits: number;
  uptime: number;
  reputationScore: number;
}

// ─── Signaling ───────────────────────────────────────────────
export type SignalType = 
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'peer-discovery'
  | 'peer-announce'
  | 'dht-store'
  | 'dht-find'
  | 'relay-request'
  | 'onion-packet'
  | 'message'
  | 'call-offer'
  | 'call-answer'
  | 'call-reject'
  | 'call-end'
  | 'typing'
  | 'presence'
  | 'register-code'
  | 'lookup-code'
  | 'code-registered'
  | 'code-result';

export interface SignalMessage {
  type: SignalType;
  from: string;
  to: string;
  payload: unknown;
  timestamp: number;
  signature?: string;
}

// ─── App State ───────────────────────────────────────────────
export interface AppState {
  identity: Identity | null;
  contacts: Contact[];
  conversations: Conversation[];
  activeConversation: string | null;
  activeCall: Call | null;
  isRelayEnabled: boolean;
  relayStats: RelayStats;
  peers: Map<string, PeerInfo>;
  onlineStatus: 'online' | 'offline' | 'away';
}

// ─── Protocol Messages ──────────────────────────────────────
export interface ProtocolMessage {
  version: number;
  type: string;
  payload: unknown;
  timestamp: number;
  nonce: string;
}

// ─── File Transfer ───────────────────────────────────────────
export interface FileTransfer {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  senderId: string;
  recipientId: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  chunks: number;
  receivedChunks: number;
}

// ─── Group ───────────────────────────────────────────────────
export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  members: GroupMember[];
  admins: string[];
  createdBy: string;
  createdAt: number;
  avatar?: string;
  groupKey: string;         // base64 symmetric key
  keyVersion: number;
}

export interface GroupMember {
  id: string;
  displayName: string;
  publicKey: string;           // ECDH encryption public key (base64)
  signingPublicKey?: string;   // ECDSA signing public key (base64)
  role: 'admin' | 'member';
  joinedAt: number;
}
