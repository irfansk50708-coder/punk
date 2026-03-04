// ============================================================
// Relay Node System - Volunteer relay node management
// Bandwidth throttling, reputation scoring, abuse protection
// ============================================================

import type { RelayNode, RelayStats, OnionPacket, PeerInfo } from '@/lib/types';
import { getOnionRouter } from '@/lib/onion';

const MAX_BANDWIDTH_KBPS = 1024;         // 1 MB/s default
const MAX_CONNECTIONS = 50;
const REPUTATION_DECAY_INTERVAL = 60000; // 1 min
const ABUSE_THRESHOLD = 100;             // packets per second
const RATE_LIMIT_WINDOW = 1000;          // 1 second

export class RelayNodeManager {
  private isRelayActive = false;
  private stats: RelayStats = {
    packetsForwarded: 0,
    bytesRelayed: 0,
    activeCircuits: 0,
    uptime: 0,
    reputationScore: 50,
  };
  private startTime = 0;
  private packetCounts: Map<string, number[]> = new Map(); // peerId -> timestamps
  private blacklist: Set<string> = new Set();
  private uptimeTimer: ReturnType<typeof setInterval> | null = null;
  private bandwidthLimit = MAX_BANDWIDTH_KBPS;
  private bytesThisSecond = 0;
  private bandwidthTimer: ReturnType<typeof setInterval> | null = null;

  // ─── Relay Node Control ──────────────────────────────────

  /**
   * Enable this node as a relay
   */
  enable(bandwidthLimitKbps?: number): void {
    if (this.isRelayActive) return;

    this.isRelayActive = true;
    this.startTime = Date.now();

    if (bandwidthLimitKbps) {
      this.bandwidthLimit = bandwidthLimitKbps;
    }

    // Uptime tracker
    this.uptimeTimer = setInterval(() => {
      this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }, 1000);

    // Bandwidth reset
    this.bandwidthTimer = setInterval(() => {
      this.bytesThisSecond = 0;
    }, 1000);

    console.log('[Relay] Node enabled as relay');
  }

  /**
   * Disable relay functionality
   */
  disable(): void {
    this.isRelayActive = false;

    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer);
      this.uptimeTimer = null;
    }

    if (this.bandwidthTimer) {
      clearInterval(this.bandwidthTimer);
      this.bandwidthTimer = null;
    }

    console.log('[Relay] Node disabled as relay');
  }

  get isActive(): boolean {
    return this.isRelayActive;
  }

  // ─── Packet Forwarding ──────────────────────────────────

  /**
   * Process and forward an onion packet
   * Returns the next hop peer ID and the unwrapped packet
   */
  async forwardPacket(
    fromPeerId: string,
    packet: OnionPacket,
    sharedSecret: CryptoKey
  ): Promise<{ nextHop: string; packet: OnionPacket } | { delivered: true; payload: string } | null> {
    if (!this.isRelayActive) {
      console.warn('[Relay] Not active, dropping packet');
      return null;
    }

    // Rate limiting
    if (!this.checkRateLimit(fromPeerId)) {
      console.warn('[Relay] Rate limit exceeded for peer:', fromPeerId);
      return null;
    }

    // Blacklist check
    if (this.blacklist.has(fromPeerId)) {
      console.warn('[Relay] Blacklisted peer:', fromPeerId);
      return null;
    }

    // Bandwidth check
    const packetSize = packet.layer.length;
    if (!this.checkBandwidth(packetSize)) {
      console.warn('[Relay] Bandwidth limit exceeded');
      return null;
    }

    // Unwrap one layer
    const router = getOnionRouter();
    const result = await router.unwrapLayer(packet, sharedSecret);

    if (!result) {
      console.error('[Relay] Failed to unwrap packet');
      return null;
    }

    // Update stats
    this.stats.packetsForwarded++;
    this.stats.bytesRelayed += packetSize;
    this.stats.activeCircuits = router.activeCircuitCount;

    if ('destination' in result && result.destination) {
      return { delivered: true, payload: result.payload };
    }

    if ('nextHop' in result) {
      return {
        nextHop: result.nextHop,
        packet: result.packet,
      };
    }

    return null;
  }

  // ─── Rate Limiting ──────────────────────────────────────

  private checkRateLimit(peerId: string): boolean {
    const now = Date.now();

    if (!this.packetCounts.has(peerId)) {
      this.packetCounts.set(peerId, []);
    }

    const timestamps = this.packetCounts.get(peerId)!;

    // Remove old timestamps
    const cutoff = now - RATE_LIMIT_WINDOW;
    const filtered = timestamps.filter((t) => t > cutoff);
    filtered.push(now);
    this.packetCounts.set(peerId, filtered);

    if (filtered.length > ABUSE_THRESHOLD) {
      // Add to blacklist temporarily
      this.blacklist.add(peerId);
      setTimeout(() => this.blacklist.delete(peerId), 60000);
      return false;
    }

    return true;
  }

  // ─── Bandwidth Throttling ───────────────────────────────

  private checkBandwidth(packetSize: number): boolean {
    const bytesPerSecondLimit = this.bandwidthLimit * 1024;
    if (this.bytesThisSecond + packetSize > bytesPerSecondLimit) {
      return false;
    }
    this.bytesThisSecond += packetSize;
    return true;
  }

  setBandwidthLimit(kbps: number): void {
    this.bandwidthLimit = Math.min(kbps, MAX_BANDWIDTH_KBPS * 10);
  }

  // ─── Reputation ─────────────────────────────────────────

  /**
   * Increase reputation for successful relay operations
   */
  incrementReputation(amount: number = 1): void {
    this.stats.reputationScore = Math.min(
      100,
      this.stats.reputationScore + amount
    );
  }

  /**
   * Decrease reputation for failures
   */
  decrementReputation(amount: number = 5): void {
    this.stats.reputationScore = Math.max(
      0,
      this.stats.reputationScore - amount
    );
  }

  // ─── Stats ──────────────────────────────────────────────

  getStats(): RelayStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      packetsForwarded: 0,
      bytesRelayed: 0,
      activeCircuits: 0,
      uptime: 0,
      reputationScore: this.stats.reputationScore,
    };
  }

  // ─── Blacklist Management ───────────────────────────────

  addToBlacklist(peerId: string): void {
    this.blacklist.add(peerId);
  }

  removeFromBlacklist(peerId: string): void {
    this.blacklist.delete(peerId);
  }

  isBlacklisted(peerId: string): boolean {
    return this.blacklist.has(peerId);
  }
}

// Singleton
let relayManager: RelayNodeManager | null = null;

export function getRelayManager(): RelayNodeManager {
  if (!relayManager) {
    relayManager = new RelayNodeManager();
  }
  return relayManager;
}
