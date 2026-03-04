// ============================================================
// Standalone Bootstrap / Signaling Server
// Run separately from the Next.js app
// Provides WebSocket-based peer discovery and signal relay
// Deploy on Fly.io, Railway, or any Node.js host
// ============================================================

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;
const PEER_TTL = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL = 30000;

// ─── Peer Registry ───────────────────────────────────────────
const peers = new Map(); // peerId -> { ws, publicKey, lastSeen, isRelay }

// ─── Short Code Registry ─────────────────────────────────────
const CODE_TTL = 10 * 60 * 1000; // 10 minutes
const codes = new Map(); // code -> { id, displayName, publicKey, encryptionPublicKey, createdAt }

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (codes.has(code));
  return code;
}

// ─── HTTP Server ─────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      peers: peers.size,
      uptime: process.uptime(),
    }));
    return;
  }

  // Info endpoint
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'PunkNet Bootstrap Server',
    version: '1.0.0',
    description: 'Decentralized signaling relay. No messages stored.',
    peers: peers.size,
    features: [
      'peer-discovery',
      'signal-relay',
      'nat-traversal',
      'short-codes',
    ],
    activeCodes: codes.size,
  }));
});

// ─── WebSocket Server ────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let peerId = null;

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);

      // Track peer ID after announcement
      if (message.type === 'peer-announce' && message.from) {
        peerId = message.from;
      }
    } catch (err) {
      console.error('[Bootstrap] Invalid message:', err.message);
    }
  });

  ws.on('close', () => {
    if (peerId) {
      peers.delete(peerId);
      broadcastPeerLeft(peerId);
      console.log(`[Bootstrap] Peer disconnected: ${peerId.slice(0, 12)}...`);
    }
  });

  ws.on('error', (err) => {
    console.error('[Bootstrap] WebSocket error:', err.message);
  });
});

// ─── Message Handler ─────────────────────────────────────────
function handleMessage(ws, message) {
  switch (message.type) {
    case 'peer-announce': {
      const { peerId, publicKey, encryptionPublicKey, isRelay } = message.payload || {};
      if (!message.from) return;

      peers.set(message.from, {
        ws,
        publicKey,
        encryptionPublicKey,
        lastSeen: Date.now(),
        isRelay: !!isRelay,
      });

      console.log(`[Bootstrap] Peer announced: ${message.from.slice(0, 12)}... (${peers.size} total)`);

      // Send current peer list to new peer
      const peerList = [];
      for (const [id, peer] of peers) {
        if (id !== message.from) {
          peerList.push({
            id,
            publicKey: peer.publicKey,
            encryptionPublicKey: peer.encryptionPublicKey,
            isRelay: peer.isRelay,
          });
        }
      }

      send(ws, {
        type: 'peer-discovery',
        from: 'bootstrap',
        to: message.from,
        payload: peerList,
        timestamp: Date.now(),
      });

      // Notify existing peers about new peer
      broadcastNewPeer(message.from, publicKey, encryptionPublicKey, isRelay);
      break;
    }

    case 'peer-discovery': {
      // Peer requesting updated peer list
      const peerList = [];
      for (const [id, peer] of peers) {
        if (id !== message.from) {
          peerList.push({
            id,
            publicKey: peer.publicKey,
            isRelay: peer.isRelay,
          });
        }
      }

      send(ws, {
        type: 'peer-discovery',
        from: 'bootstrap',
        to: message.from,
        payload: peerList,
        timestamp: Date.now(),
      });
      break;
    }

    case 'presence': {
      // Update last seen
      const peer = peers.get(message.from);
      if (peer) {
        peer.lastSeen = Date.now();
      }
      break;
    }

    case 'register-code': {
      const payload = message.payload || {};
      const code = generateCode();
      codes.set(code, {
        id: payload.id,
        displayName: payload.displayName,
        publicKey: payload.publicKey,
        encryptionPublicKey: payload.encryptionPublicKey,
        createdAt: Date.now(),
      });
      console.log(`[Bootstrap] Code registered: ${code} for ${(payload.id || '').slice(0, 12)}...`);
      send(ws, {
        type: 'code-registered',
        from: 'bootstrap',
        to: message.from,
        payload: { code },
        timestamp: Date.now(),
      });
      break;
    }

    case 'lookup-code': {
      const { code: lookupCode } = message.payload || {};
      const entry = codes.get((lookupCode || '').toUpperCase());
      if (entry && (Date.now() - entry.createdAt < CODE_TTL)) {
        send(ws, {
          type: 'code-result',
          from: 'bootstrap',
          to: message.from,
          payload: { found: true, ...entry },
          timestamp: Date.now(),
        });
      } else {
        send(ws, {
          type: 'code-result',
          from: 'bootstrap',
          to: message.from,
          payload: { found: false },
          timestamp: Date.now(),
        });
      }
      break;
    }

    // Relay signaling messages to target peer
    case 'offer':
    case 'answer':
    case 'ice-candidate':
    case 'call-offer':
    case 'call-answer':
    case 'call-reject':
    case 'call-end':
    case 'message':
    case 'typing':
    case 'relay-request':
    case 'onion-packet': {
      relayToTarget(message);
      break;
    }

    default:
      console.warn(`[Bootstrap] Unknown message type: ${message.type}`);
  }
}

// ─── Utilities ───────────────────────────────────────────────
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function relayToTarget(message) {
  const target = peers.get(message.to);
  if (target?.ws?.readyState === WebSocket.OPEN) {
    target.ws.send(JSON.stringify(message));
  } else {
    console.warn(`[Bootstrap] Target peer not found: ${message.to?.slice(0, 12)}...`);
  }
}

function broadcastNewPeer(newPeerId, publicKey, encryptionPublicKey, isRelay) {
  const announcement = {
    type: 'peer-discovery',
    from: 'bootstrap',
    to: 'broadcast',
    payload: [{
      id: newPeerId,
      publicKey,
      encryptionPublicKey,
      isRelay: !!isRelay,
    }],
    timestamp: Date.now(),
  };

  for (const [id, peer] of peers) {
    if (id !== newPeerId && peer.ws?.readyState === WebSocket.OPEN) {
      peer.ws.send(JSON.stringify({ ...announcement, to: id }));
    }
  }
}

function broadcastPeerLeft(leftPeerId) {
  const notification = {
    type: 'peer-left',
    from: 'bootstrap',
    payload: { peerId: leftPeerId },
    timestamp: Date.now(),
  };

  for (const [id, peer] of peers) {
    if (id !== leftPeerId && peer.ws?.readyState === WebSocket.OPEN) {
      peer.ws.send(JSON.stringify({ ...notification, to: id }));
    }
  }
}

// ─── Heartbeat (cleanup dead connections) ────────────────────
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });

  // Cleanup expired peers
  const now = Date.now();
  for (const [id, peer] of peers) {
    if (now - peer.lastSeen > PEER_TTL) {
      peers.delete(id);
      broadcastPeerLeft(id);
    }
  }

  // Cleanup expired codes
  for (const [code, entry] of codes) {
    if (now - entry.createdAt > CODE_TTL) {
      codes.delete(code);
    }
  }
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// ─── Start Server ────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║       PunkNet Bootstrap Server v1.0.0          ║
║                                                ║
║  WebSocket: ws://localhost:${PORT}               ║
║  Health:    http://localhost:${PORT}/health       ║
║                                                ║
║  No messages are stored.                       ║
║  Only peer discovery is facilitated.           ║
╚════════════════════════════════════════════════╝
  `);
});
