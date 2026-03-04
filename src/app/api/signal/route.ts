// ============================================================
// Bootstrap Signaling API - Serverless WebSocket relay for Vercel
// This is a REST fallback for signaling when WebSocket isn't available
// For production, use a separate WebSocket server on Fly.io/Railway
// ============================================================

import { NextResponse } from 'next/server';

// In-memory peer registry (ephemeral - only for bootstrapping)
// In production, use Redis or similar
const peers = new Map<string, {
  id: string;
  publicKey: string;
  lastSeen: number;
  encryptionPublicKey?: string;
}>();

const pendingSignals = new Map<string, Array<{
  from: string;
  type: string;
  payload: unknown;
  timestamp: number;
}>>();

const PEER_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup expired peers
function cleanup() {
  const now = Date.now();
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen > PEER_TTL) {
      peers.delete(id);
      pendingSignals.delete(id);
    }
  }
}

export async function GET(request: Request) {
  cleanup();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const peerId = searchParams.get('peerId');

  switch (action) {
    case 'peers': {
      // Return list of online peers
      const peerList = Array.from(peers.values()).map(({ id, publicKey, lastSeen }) => ({
        id,
        publicKey,
        lastSeen,
      }));
      return NextResponse.json({ peers: peerList });
    }

    case 'poll': {
      // Long-poll for pending signals
      if (!peerId) {
        return NextResponse.json({ error: 'peerId required' }, { status: 400 });
      }

      // Update last seen
      const peer = peers.get(peerId);
      if (peer) {
        peer.lastSeen = Date.now();
      }

      const signals = pendingSignals.get(peerId) || [];
      pendingSignals.set(peerId, []);

      return NextResponse.json({ signals });
    }

    default:
      return NextResponse.json({
        name: 'PunkNet Bootstrap Server',
        version: '1.0.0',
        peers: peers.size,
        description: 'Decentralized signaling relay. No messages stored.',
      });
  }
}

export async function POST(request: Request) {
  cleanup();

  try {
    const body = await request.json();
    const { action, peerId, publicKey, encryptionPublicKey, to, type, payload } = body;

    switch (action) {
      case 'announce': {
        // Register peer
        if (!peerId || !publicKey) {
          return NextResponse.json({ error: 'peerId and publicKey required' }, { status: 400 });
        }

        peers.set(peerId, {
          id: peerId,
          publicKey,
          encryptionPublicKey,
          lastSeen: Date.now(),
        });

        if (!pendingSignals.has(peerId)) {
          pendingSignals.set(peerId, []);
        }

        return NextResponse.json({ success: true, peers: peers.size });
      }

      case 'signal': {
        // Forward signal to target peer
        if (!peerId || !to || !type) {
          return NextResponse.json(
            { error: 'peerId, to, and type required' },
            { status: 400 }
          );
        }

        const targetSignals = pendingSignals.get(to);
        if (!targetSignals) {
          return NextResponse.json(
            { error: 'target peer not found' },
            { status: 404 }
          );
        }

        targetSignals.push({
          from: peerId,
          type,
          payload,
          timestamp: Date.now(),
        });

        return NextResponse.json({ success: true });
      }

      case 'leave': {
        if (peerId) {
          peers.delete(peerId);
          pendingSignals.delete(peerId);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
