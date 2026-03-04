// ============================================================
// Sidebar – MUI + Lucide
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import {
  Search,
  Plus,
  Settings,
  Radio,
  MessageSquare,
  Users,
  Shield,
  Circle,
} from 'lucide-react';
import { formatTime, truncate, generateColor } from '@/lib/utils';
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
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#030712', borderRight: '1px solid rgba(55,65,81,0.3)' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(55,65,81,0.3)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 40, height: 40, bgcolor: generateColor(identity.id), fontWeight: 600, fontSize: '0.9rem' }}>
              {identity.displayName[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>
                {identity.displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                {identity.id.slice(0, 12)}...
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <Tooltip title="Create Group" arrow>
              <IconButton size="small" onClick={onShowCreateGroup} sx={{ color: '#6b7280' }}>
                <Users size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Relay Node" arrow>
              <IconButton
                size="small"
                onClick={onShowRelay}
                sx={{ color: isRelayEnabled ? '#10b981' : '#6b7280', bgcolor: isRelayEnabled ? 'rgba(16,185,129,0.1)' : 'transparent' }}
              >
                <Radio size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Add Contact" arrow>
              <IconButton size="small" onClick={onShowAddContact} sx={{ color: '#6b7280' }}>
                <Plus size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings" arrow>
              <IconButton size="small" onClick={onShowSettings} sx={{ color: '#6b7280' }}>
                <Settings size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#6b7280" />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: 'rgba(17,24,39,0.5)', fontSize: '0.8rem' },
          }}
        />
      </Box>

      {/* Conversation List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {filteredConversations.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4, textAlign: 'center' }}>
            <MessageSquare size={48} color="#374151" />
            <Typography variant="body2" sx={{ color: '#6b7280', mt: 2, fontSize: '0.85rem' }}>
              No conversations yet
            </Typography>
            <Typography variant="caption" sx={{ color: '#4b5563', mb: 2 }}>
              Add a contact to start messaging
            </Typography>
            <Button variant="contained" size="small" onClick={onShowAddContact} sx={{ textTransform: 'none' }}>
              Add Contact
            </Button>
          </Box>
        ) : (
          filteredConversations.map((convo) => {
            const info = getConversationInfo(convo);
            const isActive = convo.id === activeConversationId;

            return (
              <Box
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  cursor: 'pointer',
                  bgcolor: isActive ? 'rgba(31,41,55,0.5)' : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': { bgcolor: isActive ? 'rgba(31,41,55,0.5)' : 'rgba(17,24,39,0.5)' },
                  borderLeft: isActive ? '3px solid #10b981' : '3px solid transparent',
                }}
              >
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  variant="dot"
                  invisible={!info.isOnline}
                  sx={{ '& .MuiBadge-badge': { bgcolor: '#10b981', border: '2px solid #030712', width: 12, height: 12, borderRadius: '50%' } }}
                >
                  <Avatar sx={{ width: 48, height: 48, bgcolor: generateColor(info.peerId || convo.id), fontWeight: 600 }}>
                    {convo.type === 'group' ? <Users size={20} /> : info.avatar}
                  </Avatar>
                </Badge>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#fff', fontSize: '0.85rem' }} noWrap>
                      {info.name}
                    </Typography>
                    {convo.lastMessage && (
                      <Typography variant="caption" sx={{ color: '#4b5563', flexShrink: 0, ml: 1, fontSize: '0.65rem' }}>
                        {formatTime(convo.lastMessage.timestamp)}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.25 }}>
                    <Typography variant="caption" sx={{ color: '#6b7280' }} noWrap>
                      {convo.lastMessage ? truncate(convo.lastMessage.content, 40) : 'No messages yet'}
                    </Typography>
                    {convo.unreadCount > 0 && (
                      <Box
                        sx={{
                          ml: 1,
                          minWidth: 20,
                          height: 20,
                          px: 0.8,
                          bgcolor: '#10b981',
                          borderRadius: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
                          {convo.unreadCount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Network Status Bar */}
      <Divider sx={{ borderColor: 'rgba(55,65,81,0.3)' }} />
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Circle size={6} fill="#10b981" color="#10b981" />
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem' }}>
              {connectedPeers.length} peers
            </Typography>
          </Box>
          {isRelayEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Radio size={10} color="#10b981" />
              <Typography variant="caption" sx={{ color: '#10b981', fontSize: '0.65rem' }}>
                Relay active
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Shield size={10} color="#4b5563" />
          <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '0.65rem' }}>
            E2E Encrypted
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
