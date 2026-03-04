// ============================================================
// WebRTC Peer Connection Manager
// Handles P2P connections, DataChannels, media streams
// ============================================================

import type { PeerConnection, PeerStatus, SignalMessage } from '@/lib/types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

const DATA_CHANNEL_OPTIONS: RTCDataChannelInit = {
  ordered: true,
  maxRetransmits: 3,
};

export type WebRTCEventType =
  | 'peer-connected'
  | 'peer-disconnected'
  | 'data-message'
  | 'media-stream'
  | 'ice-candidate'
  | 'offer-created'
  | 'answer-created'
  | 'connection-state-change'
  | 'error';

export interface WebRTCEvent {
  type: WebRTCEventType;
  peerId: string;
  data?: unknown;
}

type EventHandler = (event: WebRTCEvent) => void;

export class WebRTCManager {
  private connections: Map<string, PeerConnection> = new Map();
  private eventHandlers: Map<WebRTCEventType, Set<EventHandler>> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;

  // ─── Event System ────────────────────────────────────────
  on(type: WebRTCEventType, handler: EventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);
  }

  off(type: WebRTCEventType, handler: EventHandler): void {
    this.eventHandlers.get(type)?.delete(handler);
  }

  private emit(event: WebRTCEvent): void {
    this.eventHandlers.get(event.type)?.forEach((handler) => handler(event));
  }

  // ─── Connection Management ───────────────────────────────

  /**
   * Create a new peer connection and generate an offer
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId);

    // Create data channel
    const dataChannel = pc.createDataChannel('punk-data', DATA_CHANNEL_OPTIONS);
    this.setupDataChannel(peerId, dataChannel);

    const connection = this.connections.get(peerId)!;
    connection.dataChannel = dataChannel;

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.emit({
      type: 'offer-created',
      peerId,
      data: offer,
    });

    return offer;
  }

  /**
   * Handle an incoming offer and generate an answer
   */
  async handleOffer(
    peerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    const pc = this.createPeerConnection(peerId);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    // Apply pending ICE candidates
    await this.applyPendingCandidates(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.emit({
      type: 'answer-created',
      peerId,
      data: answer,
    });

    return answer;
  }

  /**
   * Handle an incoming answer
   */
  async handleAnswer(
    peerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection?.connection) {
      console.error('[WebRTC] No connection for peer:', peerId);
      return;
    }

    await connection.connection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );

    // Apply pending ICE candidates
    await this.applyPendingCandidates(peerId);
  }

  /**
   * Add an ICE candidate
   */
  async addIceCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const connection = this.connections.get(peerId);

    if (!connection?.connection || !connection.connection.remoteDescription) {
      // Queue candidate until remote description is set
      if (!this.pendingCandidates.has(peerId)) {
        this.pendingCandidates.set(peerId, []);
      }
      this.pendingCandidates.get(peerId)!.push(candidate);
      return;
    }

    try {
      await connection.connection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    } catch (err) {
      console.error('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  // ─── Media Streams ──────────────────────────────────────

  /**
   * Start a voice call
   */
  async startVoiceCall(peerId: string): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.addMediaStream(peerId, stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Failed to get audio stream:', err);
      this.emit({ type: 'error', peerId, data: err });
      return null;
    }
  }

  /**
   * Start a video call
   */
  async startVideoCall(peerId: string): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });

      this.localStream = stream;
      this.addMediaStream(peerId, stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Failed to get video stream:', err);
      this.emit({ type: 'error', peerId, data: err });
      return null;
    }
  }

  /**
   * Add media stream to peer connection
   */
  private addMediaStream(peerId: string, stream: MediaStream): void {
    const connection = this.connections.get(peerId);
    if (!connection?.connection) return;

    stream.getTracks().forEach((track) => {
      connection.connection!.addTrack(track, stream);
    });
  }

  /**
   * Toggle audio mute
   */
  toggleAudio(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Toggle video
   */
  toggleVideo(disabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !disabled;
      });
    }
  }

  /**
   * End call and cleanup media streams
   */
  endCall(peerId: string): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    const connection = this.connections.get(peerId);
    if (connection?.connection) {
      connection.connection.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
      });
    }
  }

  // ─── Data Channel Messaging ──────────────────────────────

  /**
   * Send data through the data channel
   */
  sendData(peerId: string, data: string): boolean {
    const connection = this.connections.get(peerId);
    if (!connection?.dataChannel || connection.dataChannel.readyState !== 'open') {
      console.warn('[WebRTC] Data channel not open for peer:', peerId);
      return false;
    }

    try {
      connection.dataChannel.send(data);
      return true;
    } catch (err) {
      console.error('[WebRTC] Failed to send data:', err);
      return false;
    }
  }

  /**
   * Send binary data through data channel
   */
  sendBinaryData(peerId: string, data: ArrayBuffer): boolean {
    const connection = this.connections.get(peerId);
    if (!connection?.dataChannel || connection.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      connection.dataChannel.send(data);
      return true;
    } catch (err) {
      console.error('[WebRTC] Failed to send binary data:', err);
      return false;
    }
  }

  // ─── Connection Status ───────────────────────────────────

  getConnectionStatus(peerId: string): PeerStatus {
    return this.connections.get(peerId)?.status || 'disconnected';
  }

  isConnected(peerId: string): boolean {
    return this.getConnectionStatus(peerId) === 'connected';
  }

  getAllConnections(): Map<string, PeerConnection> {
    return new Map(this.connections);
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.status === 'connected')
      .map(([id]) => id);
  }

  // ─── Cleanup ─────────────────────────────────────────────

  disconnectPeer(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.dataChannel?.close();
      connection.connection?.close();
      this.connections.delete(peerId);
      this.pendingCandidates.delete(peerId);
      this.emit({ type: 'peer-disconnected', peerId });
    }
  }

  disconnectAll(): void {
    for (const peerId of this.connections.keys()) {
      this.disconnectPeer(peerId);
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // ─── Private Helpers ─────────────────────────────────────

  private createPeerConnection(peerId: string): RTCPeerConnection {
    // Close existing connection if any
    const existing = this.connections.get(peerId);
    if (existing?.connection) {
      existing.connection.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    const peerConnection: PeerConnection = {
      peerId,
      status: 'connecting',
      connection: pc,
      dataChannel: null,
    };

    this.connections.set(peerId, peerConnection);

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit({
          type: 'ice-candidate',
          peerId,
          data: event.candidate.toJSON(),
        });
      }
    };

    // Connection state handler
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      let peerStatus: PeerStatus;

      switch (state) {
        case 'connected':
          peerStatus = 'connected';
          this.emit({ type: 'peer-connected', peerId });
          break;
        case 'disconnected':
        case 'closed':
          peerStatus = 'disconnected';
          this.emit({ type: 'peer-disconnected', peerId });
          break;
        case 'failed':
          peerStatus = 'failed';
          this.emit({
            type: 'error',
            peerId,
            data: new Error('Connection failed'),
          });
          break;
        default:
          peerStatus = 'connecting';
      }

      const conn = this.connections.get(peerId);
      if (conn) {
        conn.status = peerStatus;
      }

      this.emit({
        type: 'connection-state-change',
        peerId,
        data: peerStatus,
      });
    };

    // Data channel handler (for answerer)
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel);
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.dataChannel = event.channel;
      }
    };

    // Remote media stream handler
    pc.ontrack = (event) => {
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.mediaStream = event.streams[0];
      }
      this.emit({
        type: 'media-stream',
        peerId,
        data: event.streams[0],
      });
    };

    return pc;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`[WebRTC] Data channel open with ${peerId}`);
      const conn = this.connections.get(peerId);
      if (conn) conn.status = 'connected';
      this.emit({ type: 'peer-connected', peerId });
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel closed with ${peerId}`);
    };

    channel.onerror = (err) => {
      console.error(`[WebRTC] Data channel error with ${peerId}:`, err);
      this.emit({ type: 'error', peerId, data: err });
    };

    channel.onmessage = (event) => {
      this.emit({
        type: 'data-message',
        peerId,
        data: event.data,
      });
    };
  }

  private async applyPendingCandidates(peerId: string): Promise<void> {
    const candidates = this.pendingCandidates.get(peerId);
    if (!candidates) return;

    const connection = this.connections.get(peerId);
    if (!connection?.connection) return;

    for (const candidate of candidates) {
      try {
        await connection.connection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error('[WebRTC] Failed to add pending ICE candidate:', err);
      }
    }

    this.pendingCandidates.delete(peerId);
  }
}

// Singleton
let webrtcManager: WebRTCManager | null = null;

export function getWebRTCManager(): WebRTCManager {
  if (!webrtcManager) {
    webrtcManager = new WebRTCManager();
  }
  return webrtcManager;
}
