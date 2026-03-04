// ============================================================
// HTTP Polling Signaling Client - Fallback for Vercel deployment
// Uses the /api/signal REST endpoint instead of WebSocket
// ============================================================

import type { SignalMessage, SignalType } from '@/lib/types';

const POLL_INTERVAL = 2000; // 2 seconds

type SignalingHandler = (data: unknown) => void;

export class HTTPSignalingClient {
  private baseUrl: string;
  private peerId: string;
  private publicKey: string;
  private encryptionPublicKey: string;
  private handlers: Map<string, Set<SignalingHandler>> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private _isConnected = false;

  constructor(
    baseUrl: string,
    peerId: string,
    publicKey: string,
    encryptionPublicKey: string
  ) {
    this.baseUrl = baseUrl;
    this.peerId = peerId;
    this.publicKey = publicKey;
    this.encryptionPublicKey = encryptionPublicKey;
  }

  async connect(): Promise<void> {
    try {
      // Announce to server
      const res = await fetch(`${this.baseUrl}/api/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'announce',
          peerId: this.peerId,
          publicKey: this.publicKey,
          encryptionPublicKey: this.encryptionPublicKey,
        }),
      });

      if (res.ok) {
        this._isConnected = true;
        this.emit('connected', null);

        // Start polling
        this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL);

        // Initial peer discovery
        this.requestPeerList();
      }
    } catch (err) {
      console.error('[HTTPSignaling] Connection failed:', err);
      this.emit('error', err);
    }
  }

  disconnect(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Notify server
    fetch(`${this.baseUrl}/api/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', peerId: this.peerId }),
    }).catch(() => {});

    this._isConnected = false;
    this.emit('disconnected', null);
  }

  private async poll(): Promise<void> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/signal?action=poll&peerId=${this.peerId}`
      );
      const data = await res.json();

      if (data.signals?.length) {
        for (const signal of data.signals) {
          this.emit(signal.type, {
            type: signal.type,
            from: signal.from,
            to: this.peerId,
            payload: signal.payload,
            timestamp: signal.timestamp,
          });
          this.emit('message', signal);
        }
      }
    } catch (err) {
      // Silently handle poll errors
    }
  }

  async requestPeerList(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/signal?action=peers`);
      const data = await res.json();

      if (data.peers?.length) {
        this.emit('peer-discovery', {
          type: 'peer-discovery',
          from: 'bootstrap',
          to: this.peerId,
          payload: data.peers,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.error('[HTTPSignaling] Peer list failed:', err);
    }
  }

  sendSignal(toPeerId: string, type: SignalType, payload: unknown): void {
    fetch(`${this.baseUrl}/api/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signal',
        peerId: this.peerId,
        to: toPeerId,
        type,
        payload,
      }),
    }).catch((err) => {
      console.error('[HTTPSignaling] Signal failed:', err);
    });
  }

  sendOffer(toPeerId: string, offer: RTCSessionDescriptionInit): void {
    this.sendSignal(toPeerId, 'offer', offer);
  }

  sendAnswer(toPeerId: string, answer: RTCSessionDescriptionInit): void {
    this.sendSignal(toPeerId, 'answer', answer);
  }

  sendIceCandidate(toPeerId: string, candidate: RTCIceCandidateInit): void {
    this.sendSignal(toPeerId, 'ice-candidate', candidate);
  }

  // Event system
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

  get isConnected(): boolean {
    return this._isConnected;
  }

  get connectionState(): string {
    return this._isConnected ? 'connected' : 'disconnected';
  }
}
