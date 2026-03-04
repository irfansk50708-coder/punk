// ============================================================
// Signaling Client - WebSocket connection to bootstrap server
// Handles peer discovery, SDP exchange, ICE candidates
// ============================================================

import type { SignalMessage, SignalType, PeerInfo } from '@/lib/types';

const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000;

export type SignalingEventType =
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'peer-discovered'
  | 'peer-left'
  | 'error';

type SignalingHandler = (data: unknown) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private peerId: string;
  private publicKey: string;
  private handlers: Map<string, Set<SignalingHandler>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;
  private messageQueue: SignalMessage[] = [];

  constructor(serverUrl: string, peerId: string, publicKey: string) {
    this.serverUrl = serverUrl;
    this.peerId = peerId;
    this.publicKey = publicKey;
  }

  // ─── Connection ─────────────────────────────────────────

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[Signaling] Connected to bootstrap server');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Announce ourselves
        this.send({
          type: 'peer-announce',
          from: this.peerId,
          to: 'bootstrap',
          payload: {
            peerId: this.peerId,
            publicKey: this.publicKey,
          },
          timestamp: Date.now(),
        });

        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift()!;
          this.send(msg);
        }

        // Start heartbeat
        this.heartbeatTimer = setInterval(() => {
          this.send({
            type: 'presence',
            from: this.peerId,
            to: 'bootstrap',
            payload: { status: 'online' },
            timestamp: Date.now(),
          });
        }, HEARTBEAT_INTERVAL);

        this.emit('connected', null);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: SignalMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('[Signaling] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[Signaling] WebSocket error:', err);
        this.isConnecting = false;
        this.emit('error', err);
      };

      this.ws.onclose = () => {
        console.log('[Signaling] Disconnected from bootstrap server');
        this.isConnecting = false;

        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }

        this.emit('disconnected', null);
        this.attemptReconnect();
      };
    } catch (err) {
      console.error('[Signaling] Failed to connect:', err);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Signaling] Max reconnection attempts reached');
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(
        `[Signaling] Reconnecting... attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`
      );
      this.connect();
    }, RECONNECT_INTERVAL * Math.pow(1.5, this.reconnectAttempts));
  }

  // ─── Messaging ──────────────────────────────────────────

  send(message: SignalMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is established
      this.messageQueue.push(message);
    }
  }

  /**
   * Send an SDP offer to a peer
   */
  sendOffer(toPeerId: string, offer: RTCSessionDescriptionInit): void {
    this.send({
      type: 'offer',
      from: this.peerId,
      to: toPeerId,
      payload: offer,
      timestamp: Date.now(),
    });
  }

  /**
   * Send an SDP answer to a peer
   */
  sendAnswer(toPeerId: string, answer: RTCSessionDescriptionInit): void {
    this.send({
      type: 'answer',
      from: this.peerId,
      to: toPeerId,
      payload: answer,
      timestamp: Date.now(),
    });
  }

  /**
   * Send ICE candidate to a peer
   */
  sendIceCandidate(toPeerId: string, candidate: RTCIceCandidateInit): void {
    this.send({
      type: 'ice-candidate',
      from: this.peerId,
      to: toPeerId,
      payload: candidate,
      timestamp: Date.now(),
    });
  }

  /**
   * Request peer list from bootstrap server
   */
  requestPeerList(): void {
    this.send({
      type: 'peer-discovery',
      from: this.peerId,
      to: 'bootstrap',
      payload: { request: 'peer-list' },
      timestamp: Date.now(),
    });
  }

  /**
   * Send a signaling message via the bootstrap server
   */
  sendSignal(toPeerId: string, type: SignalType, payload: unknown): void {
    this.send({
      type,
      from: this.peerId,
      to: toPeerId,
      payload,
      timestamp: Date.now(),
    });
  }

  // ─── Event Handling ─────────────────────────────────────

  on(event: string, handler: SignalingHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: SignalingHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }

  private handleMessage(message: SignalMessage): void {
    // Route to specific type handlers
    this.emit(message.type, message);
    // Also emit on generic 'message' event
    this.emit('message', message);
  }

  // ─── Status ─────────────────────────────────────────────

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}

// Factory
let signalingClient: SignalingClient | null = null;

export function getSignalingClient(
  serverUrl?: string,
  peerId?: string,
  publicKey?: string
): SignalingClient | null {
  if (!signalingClient && serverUrl && peerId && publicKey) {
    signalingClient = new SignalingClient(serverUrl, peerId, publicKey);
  }
  return signalingClient;
}

export function createSignalingClient(
  serverUrl: string,
  peerId: string,
  publicKey: string
): SignalingClient {
  if (signalingClient) {
    signalingClient.disconnect();
  }
  signalingClient = new SignalingClient(serverUrl, peerId, publicKey);
  return signalingClient;
}
