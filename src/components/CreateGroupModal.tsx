// ============================================================
// Create Group Modal – MUI + Lucide
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import InputAdornment from '@mui/material/InputAdornment';
import { X, Users, Search } from 'lucide-react';
import { generateColor } from '@/lib/utils';
import type { Contact, Identity } from '@/lib/types';

interface CreateGroupModalProps {
  identity: Identity;
  contacts: Contact[];
  onCreateGroup: (name: string, description: string, members: Contact[]) => Promise<unknown>;
  onClose: () => void;
}

export default function CreateGroupModal({ identity, contacts, onCreateGroup, onClose }: CreateGroupModalProps) {
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
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
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
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: '#111827', border: '1px solid rgba(55,65,81,0.5)' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(124,58,237,0.2)' }}>
            <Users size={20} color="#a78bfa" />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
              {step === 'members' ? 'Select Members' : 'Group Details'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#6b7280' }}>
              {step === 'members' ? `${selectedMembers.size} selected` : 'Name your group'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#6b7280' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {step === 'members' ? (
          <>
            <TextField
              fullWidth
              size="small"
              placeholder="Search contacts..."
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
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: '0.8rem' } }}
            />

            {selectedMembers.size > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {Array.from(selectedMembers).map((id) => {
                  const c = contacts.find((c) => c.id === id);
                  if (!c) return null;
                  return (
                    <Chip
                      key={id}
                      label={c.displayName}
                      size="small"
                      onDelete={() => toggleMember(id)}
                      sx={{ bgcolor: 'rgba(124,58,237,0.2)', color: '#c4b5fd', fontSize: '0.75rem', '& .MuiChip-deleteIcon': { color: '#a78bfa' } }}
                    />
                  );
                })}
              </Box>
            )}

            <Box sx={{ maxHeight: 256, overflowY: 'auto' }}>
              {filteredContacts.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#6b7280', textAlign: 'center', py: 6 }}>
                  {contacts.length === 0 ? 'No contacts yet. Add contacts first.' : 'No contacts match your search.'}
                </Typography>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedMembers.has(contact.id);
                  return (
                    <Box
                      key={contact.id}
                      onClick={() => toggleMember(contact.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 3,
                        cursor: 'pointer',
                        bgcolor: isSelected ? 'rgba(124,58,237,0.08)' : 'transparent',
                        border: isSelected ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: isSelected ? 'rgba(124,58,237,0.12)' : 'rgba(31,41,55,0.3)' },
                        mb: 0.5,
                      }}
                    >
                      <Avatar sx={{ width: 40, height: 40, bgcolor: generateColor(contact.id), fontWeight: 600, fontSize: '0.85rem' }}>
                        {contact.displayName[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#fff', fontSize: '0.85rem' }} noWrap>
                          {contact.displayName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.65rem' }} noWrap>
                          {contact.id.slice(0, 16)}...
                        </Typography>
                      </Box>
                      <Checkbox
                        checked={isSelected}
                        size="small"
                        sx={{ color: '#4b5563', '&.Mui-checked': { color: '#7c3aed' } }}
                      />
                    </Box>
                  );
                })
              )}
            </Box>
          </>
        ) : (
          <>
            <TextField
              fullWidth
              label="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              autoFocus
              slotProps={{ htmlInput: { maxLength: 50 } }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="What's this group about?"
              slotProps={{ htmlInput: { maxLength: 200 } }}
              sx={{ mb: 2 }}
            />

            <Typography variant="caption" sx={{ color: '#9ca3af', mb: 1, display: 'block' }}>
              Members ({selectedMembers.size + 1})
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip label="You (admin)" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#6ee7b7', fontSize: '0.75rem' }} />
              {Array.from(selectedMembers).map((id) => {
                const c = contacts.find((c) => c.id === id);
                if (!c) return null;
                return <Chip key={id} label={c.displayName} size="small" sx={{ bgcolor: 'rgba(31,41,55,0.5)', color: '#d1d5db', fontSize: '0.75rem' }} />;
              })}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
        {step === 'details' ? (
          <Button onClick={() => setStep('members')} sx={{ color: '#9ca3af' }}>Back</Button>
        ) : <Box />}
        {step === 'members' ? (
          <Button variant="contained" color="secondary" onClick={() => setStep('details')} disabled={selectedMembers.size === 0}>
            Next
          </Button>
        ) : (
          <Button variant="contained" color="secondary" onClick={handleCreate} disabled={!groupName.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create Group'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
