// ============================================================
// Empty Chat State – MUI + Lucide
// ============================================================

'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Fade from '@mui/material/Fade';
import Grow from '@mui/material/Grow';
import { Shield, Lock, Radio, Globe } from 'lucide-react';

const features = [
  { icon: Lock, title: 'End-to-End Encrypted', desc: 'Every message is encrypted with AES-256-GCM before leaving your device', color: '#10b981' },
  { icon: Globe, title: 'Peer-to-Peer', desc: 'Messages are sent directly between devices without central servers', color: '#3b82f6' },
  { icon: Radio, title: 'Onion Routing', desc: 'Optional multi-hop routing hides your identity from the network', color: '#a855f7' },
  { icon: Shield, title: 'Forward Secrecy', desc: 'Each message uses an ephemeral key – past messages stay safe', color: '#f59e0b' },
];

export default function EmptyChat() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#030712', p: 4 }}>
      <Fade in timeout={600}>
        <Box sx={{ textAlign: 'center', maxWidth: 440 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: 4,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(13,148,136,0.15))',
              border: '1px solid rgba(16,185,129,0.1)',
              mb: 3,
            }}
          >
            <Shield size={40} color="#10b981" />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 0.5 }}>
            PunkNet Messenger
          </Typography>
          <Typography variant="body2" sx={{ color: '#6b7280', mb: 5, fontSize: '0.85rem' }}>
            Select a conversation or add a contact to start messaging securely.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, textAlign: 'left' }}>
            {features.map((f, i) => (
              <Grow in timeout={400 + i * 120} key={f.title}>
                <Paper
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: 'rgba(17,24,39,0.5)',
                    border: '1px solid rgba(55,65,81,0.3)',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(17,24,39,0.8)', borderColor: 'rgba(55,65,81,0.5)' },
                  }}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${f.color}15`, flexShrink: 0 }}>
                    <f.icon size={18} color={f.color} />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.85rem' }}>
                      {f.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {f.desc}
                    </Typography>
                  </Box>
                </Paper>
              </Grow>
            ))}
          </Box>
        </Box>
      </Fade>
    </Box>
  );
}
