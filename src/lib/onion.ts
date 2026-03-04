// ============================================================
// Onion Routing Protocol - Tor-style multi-hop encrypted routing
// Each relay peels one layer of encryption
// ============================================================

import {
  generateEncryptionKeyPair,
  deriveSharedKey,
  encrypt,
  decrypt,
  exportPublicKey,
  importECDHPublicKey,
  generateNonce,
} from '@/lib/crypto';
import { arrayBufferToBase64 } from '@/lib/utils';
import type { OnionCircuit, CircuitNode, OnionPacket, PeerInfo } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const CIRCUIT_HOP_COUNT = 3;
const CIRCUIT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PACKET_TTL = 10;

// ─── Circuit Management ──────────────────────────────────────

export class OnionRouter {
  private circuits: Map<string, OnionCircuit> = new Map();
  private relayKeys: Map<string, CryptoKey> = new Map(); // circuitId:hopIndex -> sharedSecret

  /**
   * Build an onion circuit through random relay nodes
   * Path: Sender → Guard → Middle → Exit → Recipient
   */
  async buildCircuit(
    availableRelays: PeerInfo[],
    destinationPeerId: string,
    destinationPublicKey: string
  ): Promise<OnionCircuit | null> {
    // Filter out destination from relay candidates and require relay nodes
    const candidates = availableRelays.filter(
      (p) => p.id !== destinationPeerId && p.isRelay && p.reputation > 30
    );

    if (candidates.length < CIRCUIT_HOP_COUNT) {
      console.warn(
        `[OnionRouter] Not enough relay nodes. Need ${CIRCUIT_HOP_COUNT}, have ${candidates.length}. ` +
        'Falling back to direct routing.'
      );
      // Create a direct circuit with just the destination
      const circuit: OnionCircuit = {
        id: uuidv4(),
        path: [{ peerId: destinationPeerId, publicKey: destinationPublicKey }],
        createdAt: Date.now(),
        expiresAt: Date.now() + CIRCUIT_TTL_MS,
      };
      this.circuits.set(circuit.id, circuit);
      return circuit;
    }

    // Select random relay nodes (avoid choosing same node twice)
    const selectedRelays = this.selectRandomRelays(candidates, CIRCUIT_HOP_COUNT);

    // Build circuit path with key exchange for each hop
    const path: CircuitNode[] = [];
    for (const relay of selectedRelays) {
      const ephemeralKeyPair = await generateEncryptionKeyPair();
      const relayPublicKey = await importECDHPublicKey(relay.publicKey);
      const { key: sharedSecret } = await deriveSharedKey(
        ephemeralKeyPair.privateKey,
        relayPublicKey
      );

      path.push({
        peerId: relay.id,
        publicKey: relay.publicKey,
        sharedSecret,
      });
    }

    // Add destination as last hop
    path.push({
      peerId: destinationPeerId,
      publicKey: destinationPublicKey,
    });

    const circuit: OnionCircuit = {
      id: uuidv4(),
      path,
      createdAt: Date.now(),
      expiresAt: Date.now() + CIRCUIT_TTL_MS,
    };

    this.circuits.set(circuit.id, circuit);
    return circuit;
  }

  /**
   * Wrap a message in multiple layers of encryption (onion wrapping)
   * The outermost layer is for the first relay, innermost for the destination
   */
  async wrapMessage(
    circuitId: string,
    plaintext: string
  ): Promise<OnionPacket | null> {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      console.error('[OnionRouter] Circuit not found:', circuitId);
      return null;
    }

    // Check circuit expiry
    if (Date.now() > circuit.expiresAt) {
      this.circuits.delete(circuitId);
      console.warn('[OnionRouter] Circuit expired:', circuitId);
      return null;
    }

    // Build layers from inside out
    let payload = plaintext;
    const reversedPath = [...circuit.path].reverse();

    for (const node of reversedPath) {
      if (node.sharedSecret) {
        // Wrap with encryption for this hop
        const layerData = JSON.stringify({
          nextHop: node.peerId,
          payload,
        });
        const { ciphertext, nonce } = await encrypt(node.sharedSecret, layerData);
        payload = JSON.stringify({ ciphertext, nonce, hop: node.peerId });
      } else {
        // Destination node - wrap with destination indicator
        payload = JSON.stringify({
          destination: true,
          payload,
        });
      }
    }

    return {
      circuitId,
      layer: btoa(payload),
      ttl: MAX_PACKET_TTL,
    };
  }

  /**
   * Unwrap one layer of an onion packet (called by relay nodes)
   */
  async unwrapLayer(
    packet: OnionPacket,
    sharedSecret: CryptoKey
  ): Promise<{ nextHop: string; packet: OnionPacket } | { destination: true; payload: string } | null> {
    if (packet.ttl <= 0) {
      console.warn('[OnionRouter] Packet TTL expired');
      return null;
    }

    try {
      const layerStr = atob(packet.layer);
      const layerData = JSON.parse(layerStr);

      if (layerData.destination) {
        return { destination: true, payload: layerData.payload };
      }

      const decrypted = await decrypt(sharedSecret, layerData.ciphertext, layerData.nonce);
      const inner = JSON.parse(decrypted);

      return {
        nextHop: inner.nextHop,
        packet: {
          circuitId: packet.circuitId,
          layer: btoa(inner.payload),
          ttl: packet.ttl - 1,
        },
      };
    } catch (err) {
      console.error('[OnionRouter] Failed to unwrap layer:', err);
      return null;
    }
  }

  /**
   * Select random relay nodes using Fisher-Yates shuffle
   */
  private selectRandomRelays(candidates: PeerInfo[], count: number): PeerInfo[] {
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Weight by reputation - prefer higher reputation relays
    shuffled.sort((a, b) => b.reputation - a.reputation);
    return shuffled.slice(0, count);
  }

  /**
   * Get circuit by ID
   */
  getCircuit(circuitId: string): OnionCircuit | undefined {
    return this.circuits.get(circuitId);
  }

  /**
   * Clean up expired circuits
   */
  cleanupExpiredCircuits(): void {
    const now = Date.now();
    for (const [id, circuit] of this.circuits) {
      if (now > circuit.expiresAt) {
        this.circuits.delete(id);
      }
    }
  }

  /**
   * Destroy a specific circuit
   */
  destroyCircuit(circuitId: string): void {
    this.circuits.delete(circuitId);
  }

  /**
   * Get active circuit count
   */
  get activeCircuitCount(): number {
    return this.circuits.size;
  }

  /**
   * Add traffic padding to obfuscate message lengths
   */
  padMessage(message: string, targetLength: number = 1024): string {
    if (message.length >= targetLength) return message;
    const paddingLength = targetLength - message.length;
    const padding = arrayBufferToBase64(
      crypto.getRandomValues(new Uint8Array(paddingLength)).buffer
    );
    return JSON.stringify({
      msg: message,
      pad: padding.slice(0, paddingLength),
    });
  }

  /**
   * Remove traffic padding
   */
  unpadMessage(paddedMessage: string): string {
    try {
      const parsed = JSON.parse(paddedMessage);
      return parsed.msg || paddedMessage;
    } catch {
      return paddedMessage;
    }
  }
}

// Singleton 
let onionRouterInstance: OnionRouter | null = null;

export function getOnionRouter(): OnionRouter {
  if (!onionRouterInstance) {
    onionRouterInstance = new OnionRouter();
  }
  return onionRouterInstance;
}
