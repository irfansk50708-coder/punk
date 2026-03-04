// ============================================================
// Kademlia-style Distributed Hash Table (DHT)
// Peer discovery, routing tables, value storage
// ============================================================

import type { PeerInfo, DHTEntry, RoutingEntry } from '@/lib/types';
import { sha256 } from '@/lib/crypto';

const K_BUCKET_SIZE = 20;      // Max peers per bucket
const ALPHA = 3;               // Parallelism factor
const KEY_BITS = 256;          // SHA-256 key space
const REFRESH_INTERVAL = 60000; // 1 minute

// ─── XOR Distance ────────────────────────────────────────────

function xorDistance(a: string, b: string): number {
  let distance = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance = distance * 16 + xor;
    if (distance > Number.MAX_SAFE_INTEGER / 16) break;
  }
  return distance;
}

function commonPrefixLength(a: string, b: string): number {
  let count = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) {
      count += 4; // each hex char = 4 bits
    } else {
      const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
      count += Math.clz32(xor) - 28; // leading zeros in 4-bit value
      break;
    }
  }
  return count;
}

// ─── K-Bucket ────────────────────────────────────────────────

class KBucket {
  peers: RoutingEntry[] = [];
  readonly maxSize = K_BUCKET_SIZE;

  add(entry: RoutingEntry): boolean {
    const existing = this.peers.findIndex((p) => p.peerId === entry.peerId);
    if (existing !== -1) {
      // Move to end (most recently seen)
      this.peers.splice(existing, 1);
      this.peers.push(entry);
      return true;
    }

    if (this.peers.length < this.maxSize) {
      this.peers.push(entry);
      return true;
    }

    // Bucket full - check if least recently seen is still alive
    // For now, just replace the oldest
    this.peers.shift();
    this.peers.push(entry);
    return true;
  }

  remove(peerId: string): void {
    this.peers = this.peers.filter((p) => p.peerId !== peerId);
  }

  getClosest(targetId: string, count: number): RoutingEntry[] {
    return [...this.peers]
      .sort((a, b) => xorDistance(a.peerId, targetId) - xorDistance(b.peerId, targetId))
      .slice(0, count);
  }

  get size(): number {
    return this.peers.length;
  }
}

// ─── DHT Implementation ──────────────────────────────────────

export class KademliaDHT {
  private nodeId: string;
  private buckets: KBucket[] = [];
  private storage: Map<string, DHTEntry> = new Map();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    // Initialize buckets (one per bit of key space)
    for (let i = 0; i < KEY_BITS; i++) {
      this.buckets.push(new KBucket());
    }
  }

  // ─── Routing Table ─────────────────────────────────────

  /**
   * Add a peer to the routing table
   */
  addPeer(peer: PeerInfo): void {
    if (peer.id === this.nodeId) return;

    const bucketIndex = this.getBucketIndex(peer.id);
    if (bucketIndex < 0 || bucketIndex >= this.buckets.length) return;

    const entry: RoutingEntry = {
      peerId: peer.id,
      distance: xorDistance(this.nodeId, peer.id),
      lastSeen: Date.now(),
      latency: peer.latency || 0,
    };

    this.buckets[bucketIndex].add(entry);
  }

  /**
   * Remove a peer from the routing table
   */
  removePeer(peerId: string): void {
    const bucketIndex = this.getBucketIndex(peerId);
    if (bucketIndex >= 0 && bucketIndex < this.buckets.length) {
      this.buckets[bucketIndex].remove(peerId);
    }
  }

  /**
   * Find the K closest peers to a given key
   */
  findClosestPeers(targetId: string, count: number = K_BUCKET_SIZE): RoutingEntry[] {
    const allPeers: RoutingEntry[] = [];
    for (const bucket of this.buckets) {
      allPeers.push(...bucket.peers);
    }

    return allPeers
      .sort((a, b) => xorDistance(a.peerId, targetId) - xorDistance(b.peerId, targetId))
      .slice(0, count);
  }

  /**
   * Iterative lookup - find K closest peers to a key across the network
   * Returns peers that should be queried
   */
  async iterativeFindNode(targetId: string): Promise<RoutingEntry[]> {
    const closest = this.findClosestPeers(targetId, ALPHA);
    const queried = new Set<string>();
    const results: RoutingEntry[] = [...closest];

    // In a real implementation, this would make network requests
    // For now, return local routing table results
    for (const entry of closest) {
      queried.add(entry.peerId);
    }

    return results
      .sort((a, b) => xorDistance(a.peerId, targetId) - xorDistance(b.peerId, targetId))
      .slice(0, K_BUCKET_SIZE);
  }

  // ─── Value Storage ──────────────────────────────────────

  /**
   * Store a value in the DHT
   */
  async store(key: string, value: string, publisher: string, ttl: number = 3600000): Promise<DHTEntry> {
    const hashedKey = await sha256(key);
    const entry: DHTEntry = {
      key: hashedKey,
      value,
      publisher,
      timestamp: Date.now(),
      ttl,
      signature: '', // Should be signed by publisher
    };

    this.storage.set(hashedKey, entry);
    return entry;
  }

  /**
   * Retrieve a value from the DHT
   */
  async findValue(key: string): Promise<DHTEntry | null> {
    const hashedKey = await sha256(key);
    const entry = this.storage.get(hashedKey);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.storage.delete(hashedKey);
      return null;
    }

    return entry;
  }

  /**
   * Remove expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.storage) {
      if (now - entry.timestamp > entry.ttl) {
        this.storage.delete(key);
      }
    }
  }

  // ─── Peer Discovery ─────────────────────────────────────

  /**
   * Get all known peers
   */
  getAllPeers(): RoutingEntry[] {
    const allPeers: RoutingEntry[] = [];
    for (const bucket of this.buckets) {
      allPeers.push(...bucket.peers);
    }
    return allPeers;
  }

  /**
   * Get peer count
   */
  get peerCount(): number {
    return this.buckets.reduce((sum, bucket) => sum + bucket.size, 0);
  }

  /**
   * Get relay nodes
   */
  getRelayNodes(): RoutingEntry[] {
    return this.getAllPeers().filter((p) => p.latency < 200);
  }

  // ─── Lifecycle ──────────────────────────────────────────

  start(): void {
    this.refreshTimer = setInterval(() => {
      this.cleanupExpired();
    }, REFRESH_INTERVAL);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ─── Internal ───────────────────────────────────────────

  private getBucketIndex(peerId: string): number {
    return Math.min(
      commonPrefixLength(this.nodeId, peerId),
      KEY_BITS - 1
    );
  }
}

// Singleton factory
let dhtInstance: KademliaDHT | null = null;

export function getDHT(nodeId: string): KademliaDHT {
  if (!dhtInstance) {
    dhtInstance = new KademliaDHT(nodeId);
    dhtInstance.start();
  }
  return dhtInstance;
}
