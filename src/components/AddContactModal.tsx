// ============================================================
// Add Contact Modal – Short Codes – MUI + Lucide
// ============================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import {
  X,
  Share2,
  UserPlus,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { Identity } from '@/lib/types';

interface AddContactModalProps {
  identity: Identity;
  onAddContact: (data: {
    id: string;
    displayName: string;
    publicKey: string;
    encryptionPublicKey: string;
  }) => Promise<unknown>;
  onClose: () => void;
  onRegisterCode: () => Promise<string | null>;
  onLookupCode: (code: string) => Promise<{
    id: string;
    displayName: string;
    publicKey: string;
    encryptionPublicKey: string;
  } | null>;
}

export default function AddContactModal({ identity, onAddContact, onClose, onRegisterCode, onLookupCode }: AddContactModalProps) {
  const [tab, setTab] = useState(0);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [codeInput, setCodeInput] = useState(['', '', '', '', '', '']);
  const [isLooking, setIsLooking] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [foundContact, setFoundContact] = useState<{
    id: string;
    displayName: string;
    publicKey: string;
    encryptionPublicKey: string;
  } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-generate code when Share tab opens
  useEffect(() => {
    if (tab === 0 && !shareCode && !isGenerating) {
      generateCode();
    }
  }, [tab]);

  const generateCode = async () => {
    setIsGenerating(true);
    const code = await onRegisterCode();
    setShareCode(code);
    setIsGenerating(false);
  };

  const handleCopy = async () => {
    if (!shareCode) return;
    await navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCodeInput = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(-1);
    const newCode = [...codeInput];
    newCode[index] = char;
    setCodeInput(newCode);
    setError('');
    setFoundContact(null);

    // Auto-advance to next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-lookup when all 6 filled
    const full = newCode.join('');
    if (full.length === 6 && newCode.every(c => c)) {
      lookupCode(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeInput[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...codeInput];
      newCode[index - 1] = '';
      setCodeInput(newCode);
    }
    if (e.key === 'Enter') {
      const full = codeInput.join('');
      if (full.length === 6) lookupCode(full);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
    const newCode = [...codeInput];
    for (let i = 0; i < 6; i++) newCode[i] = text[i] || '';
    setCodeInput(newCode);
    if (text.length === 6) {
      lookupCode(text);
      inputRefs.current[5]?.focus();
    } else {
      inputRefs.current[Math.min(text.length, 5)]?.focus();
    }
  };

  const lookupCode = async (code: string) => {
    setIsLooking(true);
    setError('');
    setFoundContact(null);
    const result = await onLookupCode(code);
    if (result) {
      if (result.id === identity.id) {
        setError("That's your own code!");
      } else {
        setFoundContact(result);
      }
    } else {
      setError('No contact found for this code. Check spelling or ask them to regenerate.');
    }
    setIsLooking(false);
  };

  const handleAdd = async () => {
    if (!foundContact) return;
    setIsAdding(true);
    try {
      await onAddContact(foundContact);
      onClose();
    } catch {
      setError('Failed to add contact. Try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: '#111827', border: '1px solid rgba(55,65,81,0.5)' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>Add Contact</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#9ca3af' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setError(''); }}
        variant="fullWidth"
        sx={{
          borderBottom: '1px solid rgba(55,65,81,0.3)',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.85rem' },
          '& .Mui-selected': { color: '#10b981' },
          '& .MuiTabs-indicator': { backgroundColor: '#10b981' },
        }}
      >
        <Tab icon={<Share2 size={16} />} iconPosition="start" label="My Code" />
        <Tab icon={<UserPlus size={16} />} iconPosition="start" label="Add Friend" />
      </Tabs>

      <DialogContent sx={{ p: 3 }}>
        {tab === 0 ? (
          /* ───── Share Tab ───── */
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3, fontSize: '0.82rem' }}>
              Share this code with a friend. It expires in 10 minutes.
            </Typography>

            {isGenerating ? (
              <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={28} sx={{ color: '#10b981' }} />
                <Typography variant="caption" sx={{ color: '#6b7280' }}>Generating code...</Typography>
              </Box>
            ) : shareCode ? (
              <Fade in>
                <Box>
                  {/* Big code display */}
                  <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 1,
                    mb: 3,
                  }}>
                    {shareCode.split('').map((char, i) => (
                      <Box key={i} sx={{
                        width: 48,
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 2,
                        bgcolor: 'rgba(16,185,129,0.08)',
                        border: '2px solid rgba(16,185,129,0.3)',
                      }}>
                        <Typography sx={{
                          fontSize: '1.6rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: '#10b981',
                          letterSpacing: 0,
                        }}>
                          {char}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
                    <Chip
                      icon={copied ? <Check size={14} /> : <Copy size={14} />}
                      label={copied ? 'Copied!' : 'Copy Code'}
                      onClick={handleCopy}
                      sx={{
                        height: 32,
                        fontSize: '0.78rem',
                        bgcolor: 'rgba(16,185,129,0.1)',
                        color: '#10b981',
                        '& .MuiChip-icon': { color: '#10b981' },
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(16,185,129,0.18)' },
                      }}
                    />
                    <Chip
                      icon={<RefreshCw size={14} />}
                      label="New Code"
                      onClick={generateCode}
                      sx={{
                        height: 32,
                        fontSize: '0.78rem',
                        bgcolor: 'rgba(55,65,81,0.3)',
                        color: '#9ca3af',
                        '& .MuiChip-icon': { color: '#9ca3af' },
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(55,65,81,0.5)' },
                      }}
                    />
                  </Box>
                </Box>
              </Fade>
            ) : (
              <Box sx={{ py: 3 }}>
                <Typography variant="body2" sx={{ color: '#ef4444', mb: 2, fontSize: '0.82rem' }}>
                  Failed to generate code. Make sure you're connected.
                </Typography>
                <Chip
                  icon={<RefreshCw size={14} />}
                  label="Retry"
                  onClick={generateCode}
                  sx={{ cursor: 'pointer', bgcolor: 'rgba(55,65,81,0.3)', color: '#9ca3af', '& .MuiChip-icon': { color: '#9ca3af' } }}
                />
              </Box>
            )}

            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(31,41,55,0.2)', borderRadius: 2, border: '1px solid rgba(55,65,81,0.2)' }}>
              <Typography variant="caption" sx={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'center', fontSize: '0.7rem' }}>
                {identity.displayName} &bull; {identity.id.slice(0, 8)}...
              </Typography>
            </Box>
          </Box>
        ) : (
          /* ───── Add Tab ───── */
          <Box>
            <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3, fontSize: '0.82rem', textAlign: 'center' }}>
              Enter the 6-letter code from your friend.
            </Typography>

            {/* Code input boxes */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
              {codeInput.map((char, i) => (
                <Box key={i} component="input"
                  ref={(el: HTMLInputElement | null) => { inputRefs.current[i] = el; }}
                  value={char}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  maxLength={1}
                  autoFocus={i === 0}
                  sx={{
                    width: 44,
                    height: 52,
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: '#fff',
                    bgcolor: 'rgba(31,41,55,0.4)',
                    border: char ? '2px solid rgba(16,185,129,0.5)' : '2px solid rgba(55,65,81,0.4)',
                    borderRadius: '10px',
                    outline: 'none',
                    caretColor: '#10b981',
                    transition: 'border-color 0.2s',
                    textTransform: 'uppercase',
                    '&:focus': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.05)' },
                  }}
                />
              ))}
            </Box>

            {/* Loading state */}
            {isLooking && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CircularProgress size={24} sx={{ color: '#10b981' }} />
                <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', mt: 1 }}>Looking up code...</Typography>
              </Box>
            )}

            {/* Found contact */}
            {foundContact && !isLooking && (
              <Fade in>
                <Box sx={{
                  p: 2.5,
                  bgcolor: 'rgba(16,185,129,0.06)',
                  borderRadius: 3,
                  border: '1px solid rgba(16,185,129,0.2)',
                  mb: 2,
                  textAlign: 'center',
                }}>
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 1.5,
                  }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
                      {foundContact.displayName.charAt(0).toUpperCase()}
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                    {foundContact.displayName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {foundContact.id.slice(0, 12)}...
                  </Typography>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleAdd}
                    disabled={isAdding}
                    startIcon={<UserPlus size={16} />}
                    sx={{ mt: 2, py: 1.2 }}
                  >
                    {isAdding ? 'Adding...' : `Add ${foundContact.displayName}`}
                  </Button>
                </Box>
              </Fade>
            )}

            {/* Error */}
            {error && !isLooking && <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
