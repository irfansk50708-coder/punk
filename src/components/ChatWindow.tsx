// ============================================================
// Chat Window – MUI + Lucide
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import {
  Send,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  ArrowLeft,
  Shield,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { formatTime, formatDate, generateColor } from '@/lib/utils';
import type { Message, Contact, Conversation, Identity } from '@/lib/types';

interface ChatWindowProps {
  identity: Identity;
  conversation: Conversation;
  messages: Message[];
  contact: Contact | undefined;
  isTyping: boolean;
  connectedPeers: string[];
  onSendMessage: (content: string) => void;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onTyping: (isTyping: boolean) => void;
  onBack: () => void;
}

export default function ChatWindow({
  identity,
  conversation,
  messages,
  contact,
  isTyping,
  connectedPeers,
  onSendMessage,
  onStartVoiceCall,
  onStartVideoCall,
  onTyping,
  onBack,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const peerId = conversation.participants.find((p) => p !== identity.id) || '';
  const isOnline = connectedPeers.includes(peerId);
  const displayName = contact?.displayName || peerId.slice(0, 12) + '...';

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const date = formatDate(msg.timestamp);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content) return;
    onSendMessage(content);
    setInput('');
    onTyping(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, onSendMessage, onTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    onTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending':  return <Clock size={12} color="#4b5563" />;
      case 'sent':     return <Check size={12} color="#6b7280" />;
      case 'delivered': return <CheckCheck size={12} color="#6b7280" />;
      case 'read':     return <CheckCheck size={12} color="#10b981" />;
      case 'failed':   return <AlertCircle size={12} color="#ef4444" />;
      default:         return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#030712' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid rgba(55,65,81,0.3)',
          bgcolor: 'rgba(3,7,18,0.9)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <IconButton onClick={onBack} size="small" sx={{ display: { xs: 'flex', md: 'none' }, color: '#9ca3af' }}>
          <ArrowLeft size={20} />
        </IconButton>

        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          invisible={!isOnline}
          sx={{ '& .MuiBadge-badge': { bgcolor: '#10b981', border: '2px solid #030712', width: 10, height: 10, borderRadius: '50%' } }}
        >
          <Avatar sx={{ width: 40, height: 40, bgcolor: generateColor(peerId), fontWeight: 600, fontSize: '0.9rem' }}>
            {displayName[0]?.toUpperCase()}
          </Avatar>
        </Badge>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }} noWrap>
            {displayName}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem' }}>
            {isTyping ? (
              <Box component="span" sx={{ color: '#10b981' }}>typing...</Box>
            ) : isOnline ? 'online' : contact?.lastSeen ? `last seen ${formatTime(contact.lastSeen)}` : 'offline'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Voice Call" arrow>
            <IconButton onClick={onStartVoiceCall} sx={{ color: '#9ca3af' }}>
              <Phone size={20} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Video Call" arrow>
            <IconButton onClick={onStartVideoCall} sx={{ color: '#9ca3af' }}>
              <Video size={20} />
            </IconButton>
          </Tooltip>
          <IconButton sx={{ color: '#9ca3af' }}>
            <MoreVertical size={20} />
          </IconButton>
        </Box>
      </Box>

      {/* Encryption Banner */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.8, bgcolor: 'rgba(17,24,39,0.3)' }}>
        <Lock size={11} color="#4b5563" />
        <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '0.65rem' }}>
          Messages are end-to-end encrypted. No one outside of this chat can read them.
        </Typography>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1 }}>
        {groupedMessages.map((group) => (
          <Box key={group.date}>
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <Chip
                label={group.date}
                size="small"
                sx={{ bgcolor: 'rgba(31,41,55,0.5)', color: '#6b7280', fontSize: '0.65rem', height: 24 }}
              />
            </Box>

            {group.messages.map((msg) => {
              const isMine = msg.senderId === identity.id;
              return (
                <Box key={msg.id} sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 0.5 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: '70%',
                      px: 2,
                      py: 1,
                      borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      bgcolor: isMine ? '#059669' : 'rgba(31,41,55,0.8)',
                      border: isMine ? 'none' : '1px solid rgba(55,65,81,0.3)',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: isMine ? '#fff' : '#e5e7eb', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      <Typography sx={{ fontSize: '0.6rem', color: isMine ? 'rgba(255,255,255,0.6)' : '#6b7280' }}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                      {isMine && getStatusIcon(msg.status)}
                    </Box>
                  </Paper>
                </Box>
              );
            })}
          </Box>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 0.5 }}>
            <Paper elevation={0} sx={{ px: 2, py: 1.5, borderRadius: '16px 16px 16px 4px', bgcolor: 'rgba(31,41,55,0.8)', border: '1px solid rgba(55,65,81,0.3)' }}>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[0, 150, 300].map((delay) => (
                  <Box key={delay} sx={{
                    width: 8, height: 8, borderRadius: '50%', bgcolor: '#6b7280',
                    animation: 'bounce 1.4s infinite ease-in-out',
                    animationDelay: `${delay}ms`,
                    '@keyframes bounce': {
                      '0%, 80%, 100%': { transform: 'scale(0.6)' },
                      '40%': { transform: 'scale(1)' },
                    },
                  }} />
                ))}
              </Box>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(55,65,81,0.3)', bgcolor: 'rgba(3,7,18,0.9)', backdropFilter: 'blur(12px)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <IconButton size="small" sx={{ color: '#6b7280', mb: 0.5 }}>
            <Paperclip size={20} />
          </IconButton>

          <Box sx={{ flex: 1 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'rgba(17,24,39,0.5)',
                border: '1px solid rgba(55,65,81,0.5)',
                borderRadius: 12,
                color: '#fff',
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none',
                minHeight: 42,
                maxHeight: 120,
                fontFamily: 'inherit',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(55,65,81,0.5)')}
            />
          </Box>

          <IconButton size="small" sx={{ color: '#6b7280', mb: 0.5 }}>
            <Smile size={20} />
          </IconButton>

          <Tooltip title="Send" arrow>
            <span>
              <IconButton
                onClick={handleSend}
                disabled={!input.trim()}
                sx={{
                  mb: 0.5,
                  width: 40,
                  height: 40,
                  bgcolor: input.trim() ? '#059669' : 'rgba(31,41,55,0.5)',
                  color: input.trim() ? '#fff' : '#4b5563',
                  boxShadow: input.trim() ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                  '&:hover': { bgcolor: input.trim() ? '#047857' : 'rgba(31,41,55,0.5)' },
                  transition: 'all 0.2s',
                }}
              >
                <Send size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}
