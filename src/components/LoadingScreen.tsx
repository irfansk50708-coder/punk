// ============================================================
// Loading Screen – MUI + Lucide
// ============================================================

'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';
import { Shield } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #030712 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Fade in timeout={800}>
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #10b981, #0d9488)',
              mb: 2.5,
              boxShadow: '0 8px 32px rgba(16,185,129,0.25)',
            }}
          >
            <Shield size={36} color="#fff" strokeWidth={1.8} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 1.5, letterSpacing: '-0.02em' }}>
            PunkNet
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <CircularProgress size={16} sx={{ color: '#6b7280' }} />
            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.8rem' }}>
              Initializing secure channels...
            </Typography>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
}
