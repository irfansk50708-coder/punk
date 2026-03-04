// ============================================================
// Chat Window - Message display and input
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { cn, formatTime, formatDate, generateColor } from '@/lib/utils';
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

  // Group messages by date
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content) return;

    onSendMessage(content);
    setInput('');
    onTyping(false);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input, onSendMessage, onTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    // Typing indicator
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
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-600" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-emerald-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 px-4 border-b border-gray-800/50 bg-gray-950/90 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="md:hidden p-1 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: generateColor(peerId) }}
          >
            {displayName[0]?.toUpperCase()}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-950" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm truncate">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500">
            {isTyping ? (
              <span className="text-emerald-400">typing...</span>
            ) : isOnline ? (
              'online'
            ) : contact?.lastSeen ? (
              `last seen ${formatTime(contact.lastSeen)}`
            ) : (
              'offline'
            )}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onStartVoiceCall}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Voice Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={onStartVideoCall}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="More"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Encryption Banner */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-600 bg-gray-900/30">
        <Lock className="w-3 h-3" />
        <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 bg-gray-800/50 rounded-full text-xs text-gray-500">
                {group.date}
              </span>
            </div>

            {/* Messages */}
            {group.messages.map((msg, idx) => {
              const isMine = msg.senderId === identity.id;
              const showAvatar =
                !isMine &&
                (idx === 0 ||
                  group.messages[idx - 1]?.senderId !== msg.senderId);

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2 mb-1',
                    isMine ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Message Bubble */}
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2 shadow-sm',
                      isMine
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-gray-800 text-gray-100 rounded-bl-md'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <div
                      className={cn(
                        'flex items-center gap-1 mt-1',
                        isMine ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px]',
                          isMine ? 'text-emerald-200' : 'text-gray-500'
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                      {isMine && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start mb-1">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-800/50 bg-gray-950/90 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <button className="p-2 text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 resize-none transition overflow-hidden"
              style={{ minHeight: '42px', maxHeight: '120px' }}
            />
          </div>

          <button className="p-2 text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={cn(
              'p-2.5 rounded-xl transition-all shrink-0',
              input.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
