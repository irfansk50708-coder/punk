// ============================================================
// Settings Panel – MUI + Lucide
// ============================================================

'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import {
  X,
  Shield,
  Key,
  Trash2,
  Download,
  Copy,
  Check,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { generateColor } from '@/lib/utils';
import type { Identity } from '@/lib/types';
import { clearAllData, exportAllData } from '@/lib/db';

interface SettingsProps {
  identity: Identity;
  onClose: () => void;
}

export default function SettingsPanel({ identity, onClose }: SettingsProps) {
  const [copied, setCopied] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(identity.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `punknet-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleClearData = async () => {
    if (confirm('This will delete ALL your data including messages, contacts, and your identity. This cannot be undone. Are you sure?')) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: '#111827', border: '1px solid rgba(55,65,81,0.5)', maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>Settings</Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#9ca3af' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Profile */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Avatar sx={{ width: 72, height: 72, bgcolor: generateColor(identity.id), fontSize: '2rem', fontWeight: 700, mx: 'auto', mb: 1.5 }}>
            {identity.displayName[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', fontSize: '1.1rem' }}>
            {identity.displayName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.7rem' }}>
              {identity.id.slice(0, 16)}...
            </Typography>
            <IconButton size="small" onClick={handleCopyId} sx={{ color: copied ? '#10b981' : '#6b7280', p: 0.5 }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </IconButton>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(55,65,81,0.3)', mb: 2.5 }} />

        {/* Security */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Shield size={16} color="#10b981" />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>Security</Typography>
          </Box>
          {[
            { icon: Key, label: 'End-to-End Encryption', status: 'Active' },
            { icon: Shield, label: 'Forward Secrecy', status: 'Enabled' },
          ].map((item) => (
            <Paper
              key={item.label}
              elevation={0}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, mb: 0.5, borderRadius: 2, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <item.icon size={16} color="#6b7280" />
                <Typography variant="body2" sx={{ color: '#d1d5db', fontSize: '0.8rem' }}>{item.label}</Typography>
              </Box>
              <Chip label={item.status} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.65rem', height: 22 }} />
            </Paper>
          ))}
        </Box>

        {/* Data Management */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Download size={16} color="#3b82f6" />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>Data Management</Typography>
          </Box>
          <Paper
            elevation={0}
            onClick={handleExport}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
              bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)',
              cursor: 'pointer', transition: 'all 0.15s',
              '&:hover': { bgcolor: 'rgba(31,41,55,0.4)' },
            }}
          >
            <Download size={16} color="#3b82f6" />
            <Box>
              <Typography variant="body2" sx={{ color: '#d1d5db', fontSize: '0.8rem' }}>Export Data</Typography>
              <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '0.7rem' }}>Download all your messages and contacts</Typography>
            </Box>
          </Paper>
        </Box>

        {/* About */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Info size={16} color="#9ca3af" />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>About</Typography>
          </Box>
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)' }}>
            {[
              ['Version', '1.0.0'],
              ['Protocol', 'PunkNet v1'],
              ['Encryption', 'AES-256-GCM + ECDH'],
              ['Routing', 'Onion (3-hop)'],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>{label}</Typography>
                <Typography variant="caption" sx={{ color: '#d1d5db' }}>{value}</Typography>
              </Box>
            ))}
          </Paper>
        </Box>

        {/* Danger Zone */}
        <Box>
          <Button
            onClick={() => setShowDanger(!showDanger)}
            startIcon={<AlertTriangle size={14} />}
            sx={{ color: '#ef4444', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', pl: 0 }}
          >
            Danger Zone
          </Button>
          <Collapse in={showDanger}>
            <Paper elevation={0} sx={{ p: 2, mt: 1, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <Typography variant="body2" sx={{ color: '#fca5a5', mb: 2, fontSize: '0.8rem' }}>
                This will permanently delete all your data including your identity, keys, messages, and contacts.
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<Trash2 size={14} />}
                onClick={handleClearData}
                sx={{ textTransform: 'none', fontWeight: 600, borderColor: 'rgba(239,68,68,0.3)', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
              >
                Delete All Data
              </Button>
            </Paper>
          </Collapse>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
