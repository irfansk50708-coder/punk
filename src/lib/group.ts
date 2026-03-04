// ============================================================
// Group Chat System - Distributed group messaging
// Group key management, membership, key rotation
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  GroupInfo,
  GroupMember,
  Message,
  MessageType,
  Conversation,
} from '@/lib/types';
import {
  encrypt,
  decrypt,
  generateNonce,
  sign,
  exportPublicKey,
  importECDSAPrivateKey,
  importECDHPublicKey,
  importECDHPrivateKey,
  deriveSharedKey,
  generateEncryptionKeyPair,
  sha256,
} from '@/lib/crypto';
import { getWebRTCManager } from '@/lib/webrtc';
import { saveGroup, getGroup, saveMessage, saveConversation, getConversation } from '@/lib/db';

// ─── Group Key Management ────────────────────────────────────

async function generateGroupKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importGroupKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function encryptWithGroupKey(
  groupKeyBase64: string,
  plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
  const key = await importGroupKey(groupKeyBase64);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encoded
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    nonce: btoa(String.fromCharCode(...nonce)),
  };
}

async function decryptWithGroupKey(
  groupKeyBase64: string,
  ciphertext: string,
  nonce: string
): Promise<string> {
  const key = await importGroupKey(groupKeyBase64);
  const ct = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Group Protocol Messages ─────────────────────────────────

interface GroupProtocolMessage {
  type:
    | 'group-create'
    | 'group-invite'
    | 'group-join'
    | 'group-leave'
    | 'group-message'
    | 'group-key-rotate'
    | 'group-member-add'
    | 'group-member-remove'
    | 'group-info-update';
  groupId: string;
  senderId: string;
  timestamp: number;
  payload: unknown;
}

interface GroupEncryptedPayload {
  ciphertext: string;
  nonce: string;
  senderSignature: string;
  keyVersion: number;
}

// ─── Group Chat Manager ──────────────────────────────────────

export class GroupChatManager {
  private myId: string;
  private myDisplayName: string;
  private myPublicKey: string;
  private signingPrivateKey: string;
  private encryptionPrivateKey: string;
  private groups: Map<string, GroupInfo> = new Map();
  private messageHandlers: Set<(message: Message) => void> = new Set();
  private groupUpdateHandlers: Set<(group: GroupInfo) => void> = new Set();
  private memberHandlers: Set<(groupId: string, member: GroupMember, action: 'join' | 'leave') => void> = new Set();

  constructor(
    myId: string,
    myDisplayName: string,
    myPublicKey: string,
    signingPrivateKey: string,
    encryptionPrivateKey: string
  ) {
    this.myId = myId;
    this.myDisplayName = myDisplayName;
    this.myPublicKey = myPublicKey;
    this.signingPrivateKey = signingPrivateKey;
    this.encryptionPrivateKey = encryptionPrivateKey;
  }

  // ─── Event Handlers ─────────────────────────────────────

  onMessage(handler: (message: Message) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onGroupUpdate(handler: (group: GroupInfo) => void): () => void {
    this.groupUpdateHandlers.add(handler);
    return () => this.groupUpdateHandlers.delete(handler);
  }

  onMemberChange(
    handler: (groupId: string, member: GroupMember, action: 'join' | 'leave') => void
  ): () => void {
    this.memberHandlers.add(handler);
    return () => this.memberHandlers.delete(handler);
  }

  // ─── Group Creation ─────────────────────────────────────

  async createGroup(
    name: string,
    description?: string,
    initialMembers: Array<{ id: string; displayName: string; publicKey: string }> = []
  ): Promise<GroupInfo> {
    const groupId = `group-${uuidv4()}`;
    const groupKey = await generateGroupKey();

    const group: GroupInfo = {
      id: groupId,
      name,
      description,
      members: [
        {
          id: this.myId,
          displayName: this.myDisplayName,
          publicKey: this.myPublicKey,
          role: 'admin',
          joinedAt: Date.now(),
        },
        ...initialMembers.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          publicKey: m.publicKey,
          role: 'member' as const,
          joinedAt: Date.now(),
        })),
      ],
      admins: [this.myId],
      createdBy: this.myId,
      createdAt: Date.now(),
      groupKey,
      keyVersion: 1,
    };

    // Save group locally
    await saveGroup(group);
    this.groups.set(groupId, group);

    // Create conversation for the group
    const conversation: Conversation = {
      id: groupId,
      type: 'group',
      participants: group.members.map((m) => m.id),
      name: name,
      unreadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      groupKey,
    };
    await saveConversation(conversation);

    // Send invitations to all initial members
    for (const member of initialMembers) {
      await this.sendGroupInvite(group, member.id, member.publicKey);
    }

    // Send system message
    await this.sendSystemMessage(groupId, `${this.myDisplayName} created the group "${name}"`);

    this.groupUpdateHandlers.forEach((h) => h(group));

    return group;
  }

  // ─── Send Group Invite ──────────────────────────────────

  private async sendGroupInvite(
    group: GroupInfo,
    recipientId: string,
    recipientPublicKey: string
  ): Promise<void> {
    // Encrypt group key with recipient's public key using ephemeral ECDH
    const ephemeral = await generateEncryptionKeyPair();
    const recipientKey = await importECDHPublicKey(recipientPublicKey);
    const { key: sharedKey } = await deriveSharedKey(ephemeral.privateKey, recipientKey);

    const groupInfoPayload = JSON.stringify({
      id: group.id,
      name: group.name,
      description: group.description,
      members: group.members,
      admins: group.admins,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      groupKey: group.groupKey,
      keyVersion: group.keyVersion,
    });

    const { ciphertext, nonce } = await encrypt(sharedKey, groupInfoPayload);
    const ephemeralPub = await exportPublicKey(ephemeral.publicKey);

    const protocolMsg: GroupProtocolMessage = {
      type: 'group-invite',
      groupId: group.id,
      senderId: this.myId,
      timestamp: Date.now(),
      payload: {
        ciphertext,
        nonce,
        ephemeralPublicKey: ephemeralPub,
        groupName: group.name,
      },
    };

    const webrtc = getWebRTCManager();
    webrtc.sendData(recipientId, JSON.stringify(protocolMsg));
  }

  // ─── Handle Incoming Group Messages ─────────────────────

  async handleIncomingMessage(data: string): Promise<void> {
    try {
      const parsed = JSON.parse(data) as GroupProtocolMessage;
      if (!parsed.type?.startsWith('group-')) return;

      switch (parsed.type) {
        case 'group-invite':
          await this.handleGroupInvite(parsed);
          break;
        case 'group-message':
          await this.handleGroupMessage(parsed);
          break;
        case 'group-join':
          await this.handleMemberJoin(parsed);
          break;
        case 'group-leave':
          await this.handleMemberLeave(parsed);
          break;
        case 'group-key-rotate':
          await this.handleKeyRotation(parsed);
          break;
        case 'group-member-add':
          await this.handleMemberAdd(parsed);
          break;
        case 'group-member-remove':
          await this.handleMemberRemove(parsed);
          break;
        case 'group-info-update':
          await this.handleGroupInfoUpdate(parsed);
          break;
      }
    } catch (err) {
      console.error('[GroupChat] Failed to handle message:', err);
    }
  }

  // ─── Handle Group Invite ────────────────────────────────

  private async handleGroupInvite(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as {
      ciphertext: string;
      nonce: string;
      ephemeralPublicKey: string;
      groupName: string;
    };

    try {
      // Decrypt group info using our private key
      const myPrivateKey = await importECDHPrivateKey(this.encryptionPrivateKey);
      const ephemeralPub = await importECDHPublicKey(payload.ephemeralPublicKey);
      const { key: sharedKey } = await deriveSharedKey(myPrivateKey, ephemeralPub);
      const decrypted = await decrypt(sharedKey, payload.ciphertext, payload.nonce);
      const groupData = JSON.parse(decrypted);

      const group: GroupInfo = {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description,
        members: groupData.members,
        admins: groupData.admins,
        createdBy: groupData.createdBy,
        createdAt: groupData.createdAt,
        groupKey: groupData.groupKey,
        keyVersion: groupData.keyVersion,
      };

      // Save group
      await saveGroup(group);
      this.groups.set(group.id, group);

      // Create conversation
      const conversation: Conversation = {
        id: group.id,
        type: 'group',
        participants: group.members.map((m) => m.id),
        name: group.name,
        unreadCount: 0,
        createdAt: group.createdAt,
        updatedAt: Date.now(),
        groupKey: group.groupKey,
      };
      await saveConversation(conversation);

      // Notify handlers
      this.groupUpdateHandlers.forEach((h) => h(group));

      // Send join confirmation to group members
      await this.broadcastToGroup(group.id, {
        type: 'group-join',
        groupId: group.id,
        senderId: this.myId,
        timestamp: Date.now(),
        payload: {
          memberId: this.myId,
          displayName: this.myDisplayName,
          publicKey: this.myPublicKey,
        },
      });
    } catch (err) {
      console.error('[GroupChat] Failed to process group invite:', err);
    }
  }

  // ─── Send Group Message ─────────────────────────────────

  async sendGroupMessage(
    groupId: string,
    content: string,
    type: MessageType = 'text'
  ): Promise<Message | null> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group) {
      console.error('[GroupChat] Group not found:', groupId);
      return null;
    }

    const messageId = uuidv4();
    const message: Message = {
      id: messageId,
      conversationId: groupId,
      senderId: this.myId,
      recipientId: groupId,
      type,
      content,
      timestamp: Date.now(),
      status: 'sending',
    };

    // Save locally
    await saveMessage(message);

    try {
      // Encrypt with group key
      const plaintext = JSON.stringify({
        id: message.id,
        type: message.type,
        content: message.content,
        timestamp: message.timestamp,
        senderId: this.myId,
        senderName: this.myDisplayName,
      });

      const { ciphertext, nonce } = await encryptWithGroupKey(group.groupKey, plaintext);

      // Sign the ciphertext
      const signingKey = await importECDSAPrivateKey(this.signingPrivateKey);
      const signature = await sign(signingKey, ciphertext);

      const encPayload: GroupEncryptedPayload = {
        ciphertext,
        nonce,
        senderSignature: signature,
        keyVersion: group.keyVersion,
      };

      // Broadcast to all group members
      const protocolMsg: GroupProtocolMessage = {
        type: 'group-message',
        groupId,
        senderId: this.myId,
        timestamp: message.timestamp,
        payload: encPayload,
      };

      await this.broadcastToGroup(groupId, protocolMsg);

      message.status = 'sent';
      await saveMessage(message);

      // Update conversation
      const convo = await getConversation(groupId);
      if (convo) {
        convo.lastMessage = message;
        convo.updatedAt = Date.now();
        await saveConversation(convo);
      }

      return message;
    } catch (err) {
      console.error('[GroupChat] Failed to send group message:', err);
      message.status = 'failed';
      await saveMessage(message);
      return message;
    }
  }

  // ─── Handle Incoming Group Message ──────────────────────

  private async handleGroupMessage(msg: GroupProtocolMessage): Promise<void> {
    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) {
      console.warn('[GroupChat] Received message for unknown group:', msg.groupId);
      return;
    }

    const payload = msg.payload as GroupEncryptedPayload;

    try {
      // Verify key version
      if (payload.keyVersion !== group.keyVersion) {
        console.warn('[GroupChat] Key version mismatch, may need key refresh');
      }

      // Decrypt with group key
      const plaintext = await decryptWithGroupKey(group.groupKey, payload.ciphertext, payload.nonce);
      const parsed = JSON.parse(plaintext);

      const message: Message = {
        id: parsed.id,
        conversationId: msg.groupId,
        senderId: parsed.senderId || msg.senderId,
        recipientId: msg.groupId,
        type: parsed.type || 'text',
        content: parsed.content,
        timestamp: parsed.timestamp || msg.timestamp,
        status: 'delivered',
        metadata: { senderName: parsed.senderName },
      };

      // Save message
      await saveMessage(message);

      // Update conversation
      const convo = await getConversation(msg.groupId);
      if (convo) {
        convo.lastMessage = message;
        convo.updatedAt = Date.now();
        convo.unreadCount += 1;
        await saveConversation(convo);
      }

      // Notify handlers
      this.messageHandlers.forEach((h) => h(message));
    } catch (err) {
      console.error('[GroupChat] Failed to decrypt group message:', err);
    }
  }

  // ─── Member Management ──────────────────────────────────

  async addMember(
    groupId: string,
    member: { id: string; displayName: string; publicKey: string; encryptionPublicKey: string }
  ): Promise<boolean> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group) return false;

    // Only admins can add members
    if (!group.admins.includes(this.myId)) {
      console.error('[GroupChat] Only admins can add members');
      return false;
    }

    // Check if already a member
    if (group.members.some((m) => m.id === member.id)) {
      console.warn('[GroupChat] Member already in group');
      return false;
    }

    const newMember: GroupMember = {
      id: member.id,
      displayName: member.displayName,
      publicKey: member.publicKey,
      role: 'member',
      joinedAt: Date.now(),
    };

    group.members.push(newMember);
    await saveGroup(group);
    this.groups.set(groupId, group);

    // Send invite to new member
    await this.sendGroupInvite(group, member.id, member.encryptionPublicKey);

    // Notify existing members about the new addition
    await this.broadcastToGroup(groupId, {
      type: 'group-member-add',
      groupId,
      senderId: this.myId,
      timestamp: Date.now(),
      payload: newMember,
    });

    // Send system message
    await this.sendSystemMessage(groupId, `${this.myDisplayName} added ${member.displayName}`);

    // Rotate key for forward secrecy
    await this.rotateGroupKey(groupId);

    this.memberHandlers.forEach((h) => h(groupId, newMember, 'join'));
    return true;
  }

  async removeMember(groupId: string, memberId: string): Promise<boolean> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group) return false;

    // Only admins can remove members (or member removing themselves)
    if (!group.admins.includes(this.myId) && memberId !== this.myId) {
      console.error('[GroupChat] Only admins can remove members');
      return false;
    }

    const member = group.members.find((m) => m.id === memberId);
    if (!member) return false;

    group.members = group.members.filter((m) => m.id !== memberId);
    group.admins = group.admins.filter((id) => id !== memberId);
    await saveGroup(group);
    this.groups.set(groupId, group);

    // Notify group
    await this.broadcastToGroup(groupId, {
      type: 'group-member-remove',
      groupId,
      senderId: this.myId,
      timestamp: Date.now(),
      payload: { memberId, removedBy: this.myId },
    });

    // System message
    const removedName = memberId === this.myId ? this.myDisplayName : member.displayName;
    const action = memberId === this.myId ? 'left' : 'was removed by ' + this.myDisplayName;
    await this.sendSystemMessage(groupId, `${removedName} ${action}`);

    // Rotate key so removed member can't read future messages
    await this.rotateGroupKey(groupId);

    this.memberHandlers.forEach((h) => h(groupId, member, 'leave'));
    return true;
  }

  async leaveGroup(groupId: string): Promise<void> {
    await this.removeMember(groupId, this.myId);
  }

  // ─── Key Rotation ───────────────────────────────────────

  async rotateGroupKey(groupId: string): Promise<void> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group) return;

    // Only admins can rotate keys
    if (!group.admins.includes(this.myId)) return;

    const newKey = await generateGroupKey();
    group.groupKey = newKey;
    group.keyVersion += 1;

    await saveGroup(group);
    this.groups.set(groupId, group);

    // Distribute new key to each member individually (encrypted)
    for (const member of group.members) {
      if (member.id === this.myId) continue;

      try {
        const ephemeral = await generateEncryptionKeyPair();
        const memberPubKey = await importECDHPublicKey(member.publicKey);
        const { key: sharedKey } = await deriveSharedKey(ephemeral.privateKey, memberPubKey);

        const keyPayload = JSON.stringify({
          groupKey: newKey,
          keyVersion: group.keyVersion,
        });

        const { ciphertext, nonce } = await encrypt(sharedKey, keyPayload);
        const ephemeralPub = await exportPublicKey(ephemeral.publicKey);

        const webrtc = getWebRTCManager();
        webrtc.sendData(
          member.id,
          JSON.stringify({
            type: 'group-key-rotate',
            groupId,
            senderId: this.myId,
            timestamp: Date.now(),
            payload: {
              ciphertext,
              nonce,
              ephemeralPublicKey: ephemeralPub,
              keyVersion: group.keyVersion,
            },
          })
        );
      } catch (err) {
        console.error(`[GroupChat] Failed to send rotated key to ${member.id}:`, err);
      }
    }

    // Update conversation
    const convo = await getConversation(groupId);
    if (convo) {
      convo.groupKey = newKey;
      await saveConversation(convo);
    }

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  // ─── Handle Key Rotation ────────────────────────────────

  private async handleKeyRotation(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as {
      ciphertext: string;
      nonce: string;
      ephemeralPublicKey: string;
      keyVersion: number;
    };

    try {
      const myPrivateKey = await importECDHPrivateKey(this.encryptionPrivateKey);
      const ephemeralPub = await importECDHPublicKey(payload.ephemeralPublicKey);
      const { key: sharedKey } = await deriveSharedKey(myPrivateKey, ephemeralPub);
      const decrypted = await decrypt(sharedKey, payload.ciphertext, payload.nonce);
      const parsed = JSON.parse(decrypted);

      const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
      if (!group) return;

      group.groupKey = parsed.groupKey;
      group.keyVersion = parsed.keyVersion;
      await saveGroup(group);
      this.groups.set(msg.groupId, group);

      // Update conversation
      const convo = await getConversation(msg.groupId);
      if (convo) {
        convo.groupKey = parsed.groupKey;
        await saveConversation(convo);
      }

      this.groupUpdateHandlers.forEach((h) => h(group));
    } catch (err) {
      console.error('[GroupChat] Failed to handle key rotation:', err);
    }
  }

  // ─── Handle Member Events ──────────────────────────────

  private async handleMemberJoin(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as {
      memberId: string;
      displayName: string;
      publicKey: string;
    };

    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) return;

    if (!group.members.some((m) => m.id === payload.memberId)) {
      const member: GroupMember = {
        id: payload.memberId,
        displayName: payload.displayName,
        publicKey: payload.publicKey,
        role: 'member',
        joinedAt: Date.now(),
      };
      group.members.push(member);
      await saveGroup(group);
      this.groups.set(msg.groupId, group);
      this.memberHandlers.forEach((h) => h(msg.groupId, member, 'join'));
    }

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  private async handleMemberLeave(msg: GroupProtocolMessage): Promise<void> {
    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) return;

    const member = group.members.find((m) => m.id === msg.senderId);
    if (member) {
      group.members = group.members.filter((m) => m.id !== msg.senderId);
      group.admins = group.admins.filter((id) => id !== msg.senderId);
      await saveGroup(group);
      this.groups.set(msg.groupId, group);
      this.memberHandlers.forEach((h) => h(msg.groupId, member, 'leave'));
    }

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  private async handleMemberAdd(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as GroupMember;
    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) return;

    if (!group.members.some((m) => m.id === payload.id)) {
      group.members.push(payload);
      await saveGroup(group);
      this.groups.set(msg.groupId, group);
      this.memberHandlers.forEach((h) => h(msg.groupId, payload, 'join'));
    }

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  private async handleMemberRemove(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as { memberId: string; removedBy: string };
    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) return;

    const member = group.members.find((m) => m.id === payload.memberId);
    if (member) {
      group.members = group.members.filter((m) => m.id !== payload.memberId);
      await saveGroup(group);
      this.groups.set(msg.groupId, group);
      this.memberHandlers.forEach((h) => h(msg.groupId, member, 'leave'));
    }

    // If we were removed, clean up
    if (payload.memberId === this.myId) {
      this.groups.delete(msg.groupId);
    }

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  private async handleGroupInfoUpdate(msg: GroupProtocolMessage): Promise<void> {
    const payload = msg.payload as { name?: string; description?: string };
    const group = this.groups.get(msg.groupId) || (await getGroup(msg.groupId));
    if (!group) return;

    if (payload.name) group.name = payload.name;
    if (payload.description !== undefined) group.description = payload.description;

    await saveGroup(group);
    this.groups.set(msg.groupId, group);
    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  // ─── Update Group Info ──────────────────────────────────

  async updateGroupInfo(
    groupId: string,
    updates: { name?: string; description?: string }
  ): Promise<void> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group || !group.admins.includes(this.myId)) return;

    if (updates.name) group.name = updates.name;
    if (updates.description !== undefined) group.description = updates.description;

    await saveGroup(group);
    this.groups.set(groupId, group);

    await this.broadcastToGroup(groupId, {
      type: 'group-info-update',
      groupId,
      senderId: this.myId,
      timestamp: Date.now(),
      payload: updates,
    });

    this.groupUpdateHandlers.forEach((h) => h(group));
  }

  // ─── Promote/Demote Admin ──────────────────────────────

  async promoteToAdmin(groupId: string, memberId: string): Promise<boolean> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group || !group.admins.includes(this.myId)) return false;

    if (!group.admins.includes(memberId)) {
      group.admins.push(memberId);
      const member = group.members.find((m) => m.id === memberId);
      if (member) member.role = 'admin';
      await saveGroup(group);
      this.groups.set(groupId, group);
      this.groupUpdateHandlers.forEach((h) => h(group));
    }
    return true;
  }

  // ─── Broadcast Utility ─────────────────────────────────

  private async broadcastToGroup(
    groupId: string,
    message: GroupProtocolMessage
  ): Promise<void> {
    const group = this.groups.get(groupId) || (await getGroup(groupId));
    if (!group) return;

    const webrtc = getWebRTCManager();
    const data = JSON.stringify(message);

    for (const member of group.members) {
      if (member.id === this.myId) continue;
      webrtc.sendData(member.id, data);
    }
  }

  // ─── System Messages ───────────────────────────────────

  private async sendSystemMessage(groupId: string, content: string): Promise<void> {
    const message: Message = {
      id: uuidv4(),
      conversationId: groupId,
      senderId: 'system',
      recipientId: groupId,
      type: 'system',
      content,
      timestamp: Date.now(),
      status: 'delivered',
    };

    await saveMessage(message);
    this.messageHandlers.forEach((h) => h(message));
  }

  // ─── Load Groups ────────────────────────────────────────

  async loadGroups(groups: GroupInfo[]): Promise<void> {
    for (const group of groups) {
      this.groups.set(group.id, group);
    }
  }

  getGroup(groupId: string): GroupInfo | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): GroupInfo[] {
    return Array.from(this.groups.values());
  }

  // ─── Cleanup ────────────────────────────────────────────

  destroy(): void {
    this.messageHandlers.clear();
    this.groupUpdateHandlers.clear();
    this.memberHandlers.clear();
    this.groups.clear();
  }
}

// Singleton
let manager: GroupChatManager | null = null;

export function getGroupChatManager(): GroupChatManager | null {
  return manager;
}

export function createGroupChatManager(
  myId: string,
  myDisplayName: string,
  myPublicKey: string,
  signingPrivateKey: string,
  encryptionPrivateKey: string
): GroupChatManager {
  if (manager) {
    manager.destroy();
  }
  manager = new GroupChatManager(myId, myDisplayName, myPublicKey, signingPrivateKey, encryptionPrivateKey);
  return manager;
}
