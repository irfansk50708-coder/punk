# PunkNet — Decentralized Encrypted Messenger

A production-ready, fully decentralized communication web application inspired by **WhatsApp**, **Tor**, and **WebRTC**. Zero centralized servers, zero data collection, maximum privacy.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Features](#features)
- [Protocol Specification](#protocol-specification)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Security Model](#security-model)
- [How It Works](#how-it-works)
- [Contributing](#contributing)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       PunkNet Architecture                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐     WebRTC DataChannel      ┌─────────┐           │
│  │  Peer A  │ ◄─────────────────────────► │  Peer B  │          │
│  │          │     (E2E Encrypted)         │          │          │
│  └────┬─────┘                             └────┬─────┘          │
│       │                                        │                │
│       │  ┌──────────────────────────────┐      │                │
│       └──┤   Onion-Routed Relay Mesh    ├──────┘                │
│          │  (3-hop encrypted circuits)  │                       │
│          └──────────┬───────────────────┘                       │
│                     │                                           │
│          ┌──────────▼───────────────────┐                       │
│          │    Kademlia DHT Network      │                       │
│          │  (Peer Discovery & Routing)  │                       │
│          └──────────┬───────────────────┘                       │
│                     │                                           │
│          ┌──────────▼───────────────────┐                       │
│          │   Bootstrap Signaling Server  │                       │
│          │   (WebSocket / HTTP Polling)  │                       │
│          └──────────────────────────────┘                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Client Application                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │ WebCrypto│ │  Zustand │ │ IndexedDB│ │  React UI  │  │   │
│  │  │  Engine  │ │  Store   │ │ Storage  │ │ Components │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Messaging
- **End-to-End Encrypted Chat** — Every message encrypted with ephemeral ECDH + AES-256-GCM
- **Group Chat** — Distributed group messaging with symmetric group keys and key rotation
- **Delivery & Read Receipts** — Real-time message status updates
- **Typing Indicators** — Live typing notifications over WebRTC
- **Offline Queue** — Messages queued and delivered when peer reconnects
- **System Messages** — Automatic group event notifications

### Voice & Video Calls
- **Peer-to-Peer Voice Calls** — Direct WebRTC audio streams
- **Peer-to-Peer Video Calls** — Full video calling with camera/mic controls
- **Call Controls** — Mute, camera toggle, minimizable call UI
- **No Relay Servers** — Direct peer connections for real-time media

### Privacy & Security
- **Double Ratchet Protocol** — Forward secrecy with ratcheting key derivation
- **Onion Routing** — 3-hop Tor-style encrypted circuits with traffic padding
- **No Central Authority** — No servers store your messages, keys, or metadata
- **Local-Only Storage** — All data in IndexedDB, never leaves your device
- **Digital Signatures** — ECDSA message authentication and verification
- **Key Fingerprints** — SHA-256 fingerprints for identity verification
- **Group Key Rotation** — Automatic key rotation on membership changes

### Decentralized Network
- **Kademlia DHT** — Distributed hash table for peer discovery
- **Volunteer Relay Nodes** — Any user can become a relay to strengthen the network
- **WebRTC Data Channels** — Direct peer-to-peer data transport
- **Bootstrap Server** — Minimal signaling for initial peer discovery only
- **HTTP Polling Fallback** — Works on platforms without WebSocket support

### User Experience
- **WhatsApp-Style UI** — Familiar dark-themed interface
- **Responsive Design** — Mobile-first with desktop support
- **QR Code Contact Sharing** — Quick contact exchange
- **PWA Support** — Installable as a native-like app
- **Relay Dashboard** — Monitor your relay node contributions
- **Settings Panel** — Profile management, security info, data export

---

## Protocol Specification

### Identity
Each user generates:
1. **ECDH P-256 key pair** — For Diffie-Hellman key exchange
2. **ECDSA P-256 key pair** — For digital signatures
3. **Identity fingerprint** — SHA-256 hash of public signing key (hex)

### Message Encryption (Direct)
```
Sender                                    Recipient
  │                                           │
  ├─ Generate ephemeral ECDH key pair         │
  ├─ ECDH(ephemeral.priv, recipient.pub)      │
  │  → sharedSecret                           │
  ├─ HKDF(sharedSecret) → AES-256-GCM key    │
  ├─ AES-GCM-Encrypt(message, key)            │
  │  → {ciphertext, nonce}                    │
  ├─ ECDSA-Sign(ciphertext)                   │
  │  → signature                              │
  ├─────────────────────────────────────────►  │
  │  {ciphertext, nonce, ephemeral.pub, sig}   │
  │                                           ├─ ECDH(recipient.priv, ephemeral.pub)
  │                                           │  → sharedSecret
  │                                           ├─ HKDF(sharedSecret) → key
  │                                           ├─ AES-GCM-Decrypt(ciphertext, key, nonce)
  │                                           │  → plaintext message
  │                                           ├─ ECDSA-Verify(ciphertext, sig, sender.pub)
```

### Group Encryption
- Each group has a shared AES-256-GCM symmetric key
- Group key is distributed to members via individual ECDH-encrypted channels
- Key rotates automatically when members join or leave (forward secrecy)
- All group messages encrypted with the current group key
- Messages include sender signature for authentication

### Onion Routing
```
[Sender] → [Relay 1] → [Relay 2] → [Relay 3] → [Recipient]
    │          │           │           │
    │  Encrypt with R3 key │           │
    │  Encrypt with R2 key │           │
    │  Encrypt with R1 key │           │
    │          │           │           │
    └──────────┘           │           │
       Peel layer 1        │           │
               └───────────┘           │
                  Peel layer 2         │
                           └───────────┘
                              Peel layer 3 → Plaintext
```

- 3-hop circuits with 10-minute TTL
- Each relay only knows its predecessor and successor
- Traffic padding to resist analysis (padded to 1024-byte blocks)
- Automatic circuit rebuild on expiration

### Signaling Protocol
Bootstrap signaling messages:
| Type | Direction | Purpose |
|------|-----------|---------|
| `peer-announce` | Client → Server | Register on network |
| `peer-discovery` | Server → Client | Receive peer list |
| `offer` | Peer → Peer | WebRTC SDP offer |
| `answer` | Peer → Peer | WebRTC SDP answer |
| `ice-candidate` | Peer → Peer | ICE candidate exchange |
| `call-offer` | Peer → Peer | Initiate voice/video call |
| `call-end` | Peer → Peer | Terminate call |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **UI** | React + Tailwind CSS 4 |
| **State** | Zustand |
| **Crypto** | Web Crypto API (ECDH, ECDSA, AES-GCM, HKDF, SHA-256) |
| **P2P** | WebRTC (RTCPeerConnection, DataChannel, Media Streams) |
| **Storage** | IndexedDB (via idb library) |
| **Icons** | Lucide React |
| **QR Codes** | react-qr-code |
| **Signaling** | WebSocket + HTTP polling fallback |
| **Bootstrap Server** | Node.js + ws library |

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/punk.git
cd punk

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
```

### Development

```bash
# Start the Next.js dev server
npm run dev

# In another terminal, start the bootstrap signaling server
npm run bootstrap
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
punk/
├── public/
│   └── manifest.json              # PWA manifest
├── server/
│   └── bootstrap.js               # WebSocket bootstrap signaling server
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── signal/
│   │   │       └── route.ts       # HTTP polling REST API fallback
│   │   ├── globals.css            # Global styles + dark theme
│   │   ├── layout.tsx             # Root layout + metadata
│   │   └── page.tsx               # Entry page (dynamic import)
│   ├── components/
│   │   ├── AddContactModal.tsx    # QR code + manual contact sharing
│   │   ├── CallScreen.tsx         # Voice/video call UI
│   │   ├── ChatWindow.tsx         # Message display + input
│   │   ├── CreateGroupModal.tsx   # Group creation wizard
│   │   ├── EmptyChat.tsx          # No-conversation placeholder
│   │   ├── LoadingScreen.tsx      # Initialization spinner
│   │   ├── PunkApp.tsx            # Main application orchestrator
│   │   ├── RelayDashboard.tsx     # Relay node monitoring
│   │   ├── SetupScreen.tsx        # Identity creation flow
│   │   ├── SettingsPanel.tsx      # Profile & security settings
│   │   └── Sidebar.tsx            # Conversation list + navigation
│   ├── hooks/
│   │   └── usePunkNet.ts          # Core orchestration hook
│   └── lib/
│       ├── crypto.ts              # WebCrypto: ECDH, ECDSA, AES-GCM, HKDF, Double Ratchet
│       ├── db.ts                  # IndexedDB storage layer
│       ├── dht.ts                 # Kademlia DHT implementation
│       ├── group.ts               # Group chat system (key mgmt, membership)
│       ├── messaging.ts           # E2E encrypted messaging engine
│       ├── onion.ts               # Onion routing (3-hop circuits)
│       ├── relay.ts               # Volunteer relay node system
│       ├── signaling-http.ts      # HTTP polling signaling client
│       ├── signaling.ts           # WebSocket signaling client
│       ├── store.ts               # Zustand global state
│       ├── types.ts               # TypeScript type definitions
│       ├── utils.ts               # Utility functions
│       └── webrtc.ts              # WebRTC connection manager
├── .env.example                   # Environment variable template
├── .env.local                     # Local environment config
├── next.config.ts                 # Next.js configuration
├── package.json                   # Dependencies & scripts
├── tailwind.config.ts             # Tailwind CSS config
└── tsconfig.json                  # TypeScript config
```

---

## Deployment

### Deploy to Vercel (Web App)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Important:** Vercel doesn't support WebSocket connections. The app automatically falls back to HTTP polling for signaling when deployed to Vercel. Set in your Vercel environment:

```
NEXT_PUBLIC_USE_HTTP_SIGNALING=true
NEXT_PUBLIC_BOOTSTRAP_URL=https://your-bootstrap-server.fly.dev
```

### Deploy Bootstrap Server (Fly.io)

The bootstrap server requires persistent WebSocket connections. Deploy it separately:

```bash
cd server

# Install Fly.io CLI: https://fly.io/docs/hands-on/install-flyctl/
fly launch --name punk-bootstrap

# Deploy
fly deploy
```

Or deploy to any platform supporting WebSocket (Railway, Render, self-hosted):

```bash
# Start the bootstrap server
node server/bootstrap.js
```

The bootstrap server runs on port 8080 by default (configurable via `PORT` env).

### Docker (Bootstrap Server)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/bootstrap.js .
COPY package.json .
RUN npm install ws
EXPOSE 8080
CMD ["node", "bootstrap.js"]
```

---

## Security Model

### Threat Model
| Threat | Mitigation |
|--------|-----------|
| Message interception | AES-256-GCM E2E encryption with ephemeral keys |
| Identity spoofing | ECDSA digital signatures on all messages |
| Key compromise | Forward secrecy via ephemeral ECDH per message |
| Traffic analysis | Onion routing with 3-hop circuits + traffic padding |
| Metadata collection | Decentralized DHT, no central server logs |
| Group key leakage | Automatic key rotation on membership changes |
| Replay attacks | Unique nonces (12-byte random IV) per message |
| Man-in-the-Middle | Key fingerprint verification system |

### What PunkNet Does NOT Protect Against
- **Device compromise** — If your device is compromised, stored keys are accessible
- **Endpoint monitoring** — Screen capture or keyloggers on the device
- **Traffic confirmation attacks** — Global adversary observing all network entry/exit points
- **Quantum computing** — Uses classical EC cryptography (P-256), not post-quantum

### Key Algorithms
- **Key Exchange:** ECDH P-256
- **Encryption:** AES-256-GCM (128-bit auth tag)
- **Signatures:** ECDSA P-256
- **Key Derivation:** HKDF-SHA-256
- **Hashing:** SHA-256
- **Forward Secrecy:** Double Ratchet protocol (simplified Signal)

---

## How It Works

### 1. Identity Creation
When you first open PunkNet, you generate a cryptographic identity:
- An ECDH key pair for encryption
- An ECDSA key pair for signing
- A SHA-256 fingerprint as your unique ID
- Everything stored locally in IndexedDB

### 2. Peer Discovery
- Your client connects to a bootstrap signaling server
- Announces your peer ID and public key
- Receives a list of known peers
- Uses Kademlia DHT for ongoing peer discovery

### 3. Direct Connection
- WebRTC offer/answer exchanged via signaling
- ICE candidates negotiated for NAT traversal
- DataChannel established for encrypted messaging
- Media streams added for voice/video calls

### 4. Sending a Message
1. Generate ephemeral ECDH key pair
2. Derive shared secret with recipient's public key
3. Derive AES-256-GCM key via HKDF
4. Encrypt message content
5. Sign with your ECDSA private key
6. Send via WebRTC DataChannel (or queue if offline)

### 5. Group Messaging
1. Creator generates AES-256-GCM group key
2. Group key sent to each member via individual ECDH-encrypted channels
3. Messages encrypted with shared group key
4. Key rotates on member join/leave for forward secrecy

### 6. Acting as a Relay
- Toggle relay mode in the dashboard
- Your node forwards onion-encrypted packets
- Rate limiting (100 packets/sec) and bandwidth throttling
- Reputation system tracks relay performance

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run bootstrap` | Start WebSocket bootstrap server |

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>PunkNet</strong> — Encrypted. Decentralized. Unstoppable.
</p>
