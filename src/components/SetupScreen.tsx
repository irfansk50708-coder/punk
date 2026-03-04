// ============================================================
// Setup Screen – MUI + Lucide
// ============================================================

'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';
import Grow from '@mui/material/Grow';
import {
  Shield,
  Key,
  Fingerprint,
  ArrowRight,
  Lock,
  Sparkles,
} from 'lucide-react';

interface SetupScreenProps {
  onComplete: (displayName: string) => Promise<void>;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const steps = [
    { icon: Key, label: 'Generating encryption keys' },
    { icon: Fingerprint, label: 'Creating identity fingerprint' },
    { icon: Shield, label: 'Securing your account' },
    { icon: Lock, label: 'Ready!' },
  ];

  const handleCreate = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      for (let i = 0; i < steps.length; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, 700));
      }
      await onComplete(displayName.trim());
    } catch {
      setError('Failed to create identity. Please try again.');
      setIsCreating(false);
    }
  };

  const features = [
    { icon: Key, title: 'End-to-End Encrypted', desc: 'Messages encrypted with AES-256-GCM', color: '#10b981' },
    { icon: Shield, title: 'No Central Server', desc: 'Direct peer-to-peer communication', color: '#3b82f6' },
    { icon: Fingerprint, title: 'Cryptographic Identity', desc: 'Public/private key pair authentication', color: '#a855f7' },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #030712 0%, #0f172a 40%, #030712 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 30% 70%, rgba(16,185,129,0.04) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(59,130,246,0.03) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Fade in timeout={600}>
        <Box sx={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: 4,
                background: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
                mb: 2,
                boxShadow: '0 8px 32px rgba(16,185,129,0.25)',
                position: 'relative',
              }}
            >
              <Shield size={40} color="#fff" strokeWidth={1.8} />
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={12} color="#fff" />
              </Box>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              PunkNet
            </Typography>
            <Typography variant="subtitle2" sx={{ color: '#6b7280', mt: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.7rem' }}>
              Decentralized &middot; Encrypted &middot; Private
            </Typography>
          </Box>

          {/* Setup Card */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 4,
              border: '1px solid rgba(55,65,81,0.4)',
              backgroundColor: 'rgba(17,24,39,0.8)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            {!isCreating ? (
              <Fade in timeout={400}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}>
                    Create Your Identity
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6b7280', mb: 3, lineHeight: 1.6 }}>
                    Your identity is generated locally using cryptographic keys.
                    No servers, no accounts, no tracking.
                  </Typography>

                  <TextField
                    fullWidth
                    label="Display Name"
                    variant="outlined"
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter your name..."
                    autoFocus
                    slotProps={{ htmlInput: { maxLength: 32 } }}
                    error={!!error}
                    helperText={error || ' '}
                    sx={{ mb: 2 }}
                  />

                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleCreate}
                    endIcon={<ArrowRight size={18} />}
                    sx={{ py: 1.6, fontSize: '0.95rem', mb: 3 }}
                  >
                    Generate Keys &amp; Create Identity
                  </Button>

                  {/* Feature Cards */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {features.map((item, i) => (
                      <Grow in timeout={400 + i * 150} key={item.title}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 2,
                            p: 2,
                            borderRadius: 2.5,
                            backgroundColor: 'rgba(31,41,55,0.3)',
                            border: '1px solid rgba(55,65,81,0.2)',
                            transition: 'all 0.2s ease',
                            '&:hover': { backgroundColor: 'rgba(31,41,55,0.5)', borderColor: 'rgba(55,65,81,0.4)' },
                          }}
                        >
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: `${item.color}15`,
                              flexShrink: 0,
                            }}
                          >
                            <item.icon size={18} color={item.color} />
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.85rem' }}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                              {item.desc}
                            </Typography>
                          </Box>
                        </Box>
                      </Grow>
                    ))}
                  </Box>
                </Box>
              </Fade>
            ) : (
              <Fade in timeout={400}>
                <Box sx={{ py: 4 }}>
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <CircularProgress size={48} sx={{ color: '#10b981', mb: 2 }} />
                    <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                      Setting up your secure identity...
                    </Typography>
                  </Box>

                  <Stepper
                    activeStep={step}
                    orientation="vertical"
                    sx={{
                      '& .MuiStepConnector-line': { borderColor: 'rgba(55,65,81,0.5)', minHeight: 20 },
                      '& .MuiStepLabel-iconContainer': { pr: 2 },
                    }}
                  >
                    {steps.map((s, i) => {
                      const StepIcon = s.icon;
                      return (
                        <Step key={i} completed={i < step}>
                          <StepLabel
                            StepIconComponent={() => (
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: i <= step ? 'rgba(16,185,129,0.15)' : 'rgba(31,41,55,0.5)',
                                  border: i === step ? '2px solid #10b981' : '1px solid transparent',
                                  transition: 'all 0.3s ease',
                                }}
                              >
                                {i === step ? (
                                  <CircularProgress size={14} sx={{ color: '#10b981' }} />
                                ) : (
                                  <StepIcon size={14} color={i < step ? '#10b981' : '#6b7280'} />
                                )}
                              </Box>
                            )}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                color: i === step ? '#10b981' : i < step ? '#9ca3af' : '#4b5563',
                                fontWeight: i === step ? 600 : 400,
                              }}
                            >
                              {s.label}
                            </Typography>
                          </StepLabel>
                        </Step>
                      );
                    })}
                  </Stepper>
                </Box>
              </Fade>
            )}
          </Paper>

          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: '#4b5563', fontSize: '0.7rem' }}>
            All data is stored locally on your device. Nothing leaves your browser unencrypted.
          </Typography>
        </Box>
      </Fade>
    </Box>
  );
}
