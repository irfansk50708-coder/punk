// ============================================================
// Create Group Modal - UI for creating group chats
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import { X, Users, Check, Search } from 'lucide-react';
import { cn, generateColor } from '@/lib/utils';
import type { Contact, Identity } from '@/lib/types';

interface CreateGroupModalProps {
  identity: Identity;
  contacts: Contact[];
  onCreateGroup: (name: string, description: string, members: Contact[]) => Promise<unknown>;
  onClose: () => void;
}

export default function CreateGroupModal({
  identity,
  contacts,
  onCreateGroup,
  onClose,
}: CreateGroupModalProps) {
  const [step, setStep] = useState<'members' | 'details'>('members');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredContacts = contacts.filter((c) =>
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMember = useCallback((contactId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim() || selectedMembers.size === 0) return;

    setIsCreating(true);
    try {
      const members = contacts.filter((c) => selectedMembers.has(c.id));
      await onCreateGroup(groupName.trim(), groupDescription.trim(), members);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setIsCreating(false);
    }
  }, [groupName, groupDescription, selectedMembers, contacts, onCreateGroup, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">
                {step === 'members' ? 'Select Members' : 'Group Details'}
              </h2>
              <p className="text-xs text-gray-500">
                {step === 'members'
                  ? `${selectedMembers.size} selected`
                  : 'Name your group'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === 'members' ? (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition"
                />
              </div>

              {/* Selected pills */}
              {selectedMembers.size > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {Array.from(selectedMembers).map((id) => {
                    const contact = contacts.find((c) => c.id === id);
                    if (!contact) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => toggleMember(id)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-violet-600/20 text-violet-300 rounded-full text-xs hover:bg-violet-600/30 transition"
                      >
                        {contact.displayName}
                        <X className="w-3 h-3" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Contact list */}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredContacts.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">
                    {contacts.length === 0
                      ? 'No contacts yet. Add contacts first.'
                      : 'No contacts match your search.'}
                  </p>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected = selectedMembers.has(contact.id);
                    return (
                      <button
                        key={contact.id}
                        onClick={() => toggleMember(contact.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl transition-colors',
                          isSelected
                            ? 'bg-violet-600/10 border border-violet-500/30'
                            : 'hover:bg-gray-800/50 border border-transparent'
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                          style={{ backgroundColor: generateColor(contact.id) }}
                        >
                          {contact.displayName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {contact.displayName}
                          </p>
                          <p className="text-gray-500 text-xs font-mono truncate">
                            {contact.id.slice(0, 16)}...
                          </p>
                        </div>
                        <div
                          className={cn(
                            'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'bg-violet-600 border-violet-500'
                              : 'border-gray-600'
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Group name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition"
                  autoFocus
                  maxLength={50}
                />
              </div>

              {/* Group description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="What's this group about?"
                  className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition resize-none"
                  rows={3}
                  maxLength={200}
                />
              </div>

              {/* Members preview */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Members ({selectedMembers.size + 1})
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* You */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 text-emerald-300 rounded-full text-xs">
                    You (admin)
                  </div>
                  {Array.from(selectedMembers).map((id) => {
                    const contact = contacts.find((c) => c.id === id);
                    if (!contact) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs"
                      >
                        {contact.displayName}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-between">
          {step === 'details' && (
            <button
              onClick={() => setStep('members')}
              className="px-4 py-2.5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Back
            </button>
          )}

          <div className="ml-auto">
            {step === 'members' ? (
              <button
                onClick={() => setStep('details')}
                disabled={selectedMembers.size === 0}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!groupName.trim() || isCreating}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create Group'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
