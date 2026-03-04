// ============================================================
// Main Application Component – MUI + Lucide
// ============================================================

'use client';

import { useMemo, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { usePunkNet } from '@/hooks/usePunkNet';
import SetupScreen from '@/components/SetupScreen';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import CallScreen from '@/components/CallScreen';
import AddContactModal from '@/components/AddContactModal';
import SettingsPanel from '@/components/SettingsPanel';
import RelayDashboard from '@/components/RelayDashboard';
import CreateGroupModal from '@/components/CreateGroupModal';
import EmptyChat from '@/components/EmptyChat';
import LoadingScreen from '@/components/LoadingScreen';

export default function PunkApp() {
  const {
    identity,
    contacts,
    conversations,
    messages,
    activeConversationId,
    activeCall,
    isOnline,
    isInitialized,
    isLoading,
    connectedPeers,
    typingPeers,
    isRelayEnabled,
    relayStats,
    createIdentity,
    addContact,
    sendMessage,
    startCall,
    endCall,
    toggleRelay,
    sendTyping,
    createGroup,
    sendGroupMessage,
    registerShareCode,
    lookupShareCode,
    setActiveConversation,
    setShowSettings,
    setShowAddContact,
    setShowRelayDashboard,
    showSettings,
    showAddContact,
    showRelayDashboard,
  } = usePunkNet();

  const [isMobileChat, setIsMobileChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Active conversation data
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const activeMessages = useMemo(
    () => (activeConversationId ? messages[activeConversationId] || [] : []),
    [messages, activeConversationId]
  );

  const activePeerId = useMemo(() => {
    if (!activeConversation || !identity) return '';
    return activeConversation.participants.find((p) => p !== identity.id) || '';
  }, [activeConversation, identity]);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activePeerId),
    [contacts, activePeerId]
  );

  const callContact = useMemo(() => {
    if (!activeCall) return undefined;
    return contacts.find(
      (c) => c.id === activeCall.receiverId || c.id === activeCall.callerId
    );
  }, [activeCall, contacts]);

  // Handlers
  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
      setIsMobileChat(true);
    },
    [setActiveConversation]
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (activeConversation?.type === 'group') {
        sendGroupMessage(activeConversation.id, content);
      } else if (activePeerId) {
        sendMessage(activePeerId, content);
      }
    },
    [activeConversation, activePeerId, sendMessage, sendGroupMessage]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (activePeerId) {
        sendTyping(activePeerId, isTyping);
      }
    },
    [activePeerId, sendTyping]
  );

  const handleBack = useCallback(() => {
    setIsMobileChat(false);
    setActiveConversation(null);
  }, [setActiveConversation]);

  // Loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Setup screen
  if (!identity) {
    return (
      <SetupScreen
        onComplete={async (name) => {
          await createIdentity(name);
        }}
      />
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: '#030712', overflow: 'hidden' }}>
      {/* Sidebar */}
      <Box
        sx={{
          display: { xs: isMobileChat ? 'none' : 'flex', md: 'flex' },
          width: { xs: '100%', md: 320, lg: 384 },
          flexShrink: 0,
          borderRight: '1px solid rgba(31,41,55,0.5)',
        }}
      >
        <Sidebar
          identity={identity}
          conversations={conversations}
          contacts={contacts}
          activeConversationId={activeConversationId}
          connectedPeers={connectedPeers}
          isRelayEnabled={isRelayEnabled}
          onSelectConversation={handleSelectConversation}
          onShowAddContact={() => setShowAddContact(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowRelay={() => setShowRelayDashboard(true)}
          onShowCreateGroup={() => setShowCreateGroup(true)}
        />
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          display: { xs: isMobileChat ? 'flex' : 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {activeConversation ? (
          <ChatWindow
            identity={identity}
            conversation={activeConversation}
            messages={activeMessages}
            contact={activeContact}
            isTyping={!!typingPeers[activePeerId]}
            connectedPeers={connectedPeers}
            onSendMessage={handleSendMessage}
            onStartVoiceCall={() => startCall(activePeerId, 'voice')}
            onStartVideoCall={() => startCall(activePeerId, 'video')}
            onTyping={handleTyping}
            onBack={handleBack}
          />
        ) : (
          <EmptyChat />
        )}
      </Box>

      {/* Active Call */}
      {activeCall && (
        <CallScreen
          call={activeCall}
          contact={callContact}
          onEndCall={endCall}
        />
      )}

      {/* Modals */}
      {showAddContact && (
        <AddContactModal
          identity={identity}
          onAddContact={addContact}
          onClose={() => setShowAddContact(false)}
          onRegisterCode={registerShareCode}
          onLookupCode={lookupShareCode}
        />
      )}

      {showSettings && (
        <SettingsPanel
          identity={identity}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showRelayDashboard && (
        <RelayDashboard
          isRelayEnabled={isRelayEnabled}
          relayStats={relayStats}
          onToggleRelay={toggleRelay}
          onClose={() => setShowRelayDashboard(false)}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          identity={identity}
          contacts={contacts}
          onCreateGroup={createGroup}
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </Box>
  );
}
