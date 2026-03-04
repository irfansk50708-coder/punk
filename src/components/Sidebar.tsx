// ============================================================
// Sidebar - Conversation list, contacts, search
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Settings,
  Radio,
  MessageSquare,
  Phone,
  Users,
  Shield,
  Circle,
} from 'lucide-react';
import { cn, formatTime, truncate, generateColor } from '@/lib/utils';
import type { Conversation, Contact, Identity } from '@/lib/types';

interface SidebarProps {
  identity: Identity;
  conversations: Conversation[];
  contacts: Contact[];
  activeConversationId: string | null;
  connectedPeers: string[];
  isRelayEnabled: boolean;
  onSelectConversation: (id: string) => void;
  onShowAddContact: () => void;
  onShowSettings: () => void;
  onShowRelay: () => void;
  onShowCreateGroup: () => void;
}

export default function Sidebar({
  identity,
  conversations,
  contacts,
  activeConversationId,
  connectedPeers,
  isRelayEnabled,
  onSelectConversation,
  onShowAddContact,
  onShowSettings,
  onShowRelay,
  onShowCreateGroup,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const peerId = c.participants.find((p) => p !== identity.id);
      const contact = peerId ? contactMap.get(peerId) : null;
      return (
        contact?.displayName.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.lastMessage?.content.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, contactMap, identity.id]);

  const getConversationInfo = (conversation: Conversation) => {
    if (conversation.type === 'group') {
      return {
        name: conversation.name || 'Group Chat',
        avatar: conversation.name?.[0]?.toUpperCase() || 'G',
        isOnline: false,
        peerId: '',
      };
    }

    const peerId = conversation.participants.find((p) => p !== identity.id) || '';
    const contact = contactMap.get(peerId);

    return {
      name: contact?.displayName || peerId.slice(0, 8) + '...',
      avatar: (contact?.displayName || peerId)[0]?.toUpperCase() || '?',
      isOnline: connectedPeers.includes(peerId),
      peerId,
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 border-r border-gray-800/50">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ backgroundColor: generateColor(identity.id) }}
            >
              {identity.displayName[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">
                {identity.displayName}
              </h2>
              <p className="text-xs text-gray-500 font-mono">
                {identity.id.slice(0, 12)}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onShowCreateGroup}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Create Group"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={onShowRelay}
              className={cn(
                'p-2 rounded-lg transition-colors',
                isRelayEnabled
                  ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              )}
              title="Relay Node"
            >
              <Radio className="w-4 h-4" />
            </button>
            <button
              onClick={onShowAddContact}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Add Contact"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={onShowSettings}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 transition"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm">No conversations yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Add a contact to start messaging
            </p>
            <button
              onClick={onShowAddContact}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
            >
              Add Contact
            </button>
          </div>
        ) : (
          filteredConversations.map((convo) => {
            const info = getConversationInfo(convo);
            const isActive = convo.id === activeConversationId;

            return (
              <button
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 px-4 hover:bg-gray-900/50 transition-colors text-left',
                  isActive && 'bg-gray-800/50'
                )}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{
                      backgroundColor: generateColor(info.peerId || convo.id),
                    }}
                  >
                    {convo.type === 'group' ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      info.avatar
                    )}
                  </div>
                  {info.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-gray-950" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate">
                      {info.name}
                    </span>
                    {convo.lastMessage && (
                      <span className="text-gray-600 text-xs shrink-0 ml-2">
                        {formatTime(convo.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-gray-500 text-xs truncate">
                      {convo.lastMessage
                        ? truncate(convo.lastMessage.content, 40)
                        : 'No messages yet'}
                    </p>
                    {convo.unreadCount > 0 && (
                      <span className="ml-2 shrink-0 min-w-[20px] h-5 px-1.5 bg-emerald-500 rounded-full text-white text-xs font-medium flex items-center justify-center">
                        {convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Network Status Bar */}
      <div className="p-3 border-t border-gray-800/50 bg-gray-950/80">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="flex items-center gap-1">
              <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
              <span>{connectedPeers.length} peers</span>
            </div>
            {isRelayEnabled && (
              <div className="flex items-center gap-1 text-emerald-400">
                <Radio className="w-3 h-3" />
                <span>Relay active</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Shield className="w-3 h-3" />
            <span>E2E Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
