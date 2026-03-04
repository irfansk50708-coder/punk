// ============================================================
// Relay Node Dashboard – MUI + Lucide
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import {
  X,
  Radio,
  Activity,
  Zap,
  Shield,
  ArrowUpDown,
  Clock,
  Star,
  Gauge,
} from 'lucide-react';
import type { RelayStats } from '@/lib/types';
import { getRelayManager } from '@/lib/relay';

interface RelayDashboardProps {
  isRelayEnabled: boolean;
  relayStats: RelayStats;
  onToggleRelay: (enabled: boolean) => void;
  onClose: () => void;
}

export default function RelayDashboard({ isRelayEnabled, relayStats, onToggleRelay, onClose }: RelayDashboardProps) {
  const [bandwidthLimit, setBandwidthLimit] = useState(1024);
  const [liveStats, setLiveStats] = useState<RelayStats>(relayStats);

  useEffect(() => {
    if (!isRelayEnabled) return;
    const timer = setInterval(() => {
      const relay = getRelayManager();
      setLiveStats(relay.getStats());
    }, 1000);
    return () => clearInterval(timer);
  }, [isRelayEnabled]);

  const handleBandwidthChange = (_: Event, value: number | number[]) => {
    const v = value as number;
    setBandwidthLimit(v);
    const relay = getRelayManager();
    relay.setBandwidthLimit(v);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const stats = isRelayEnabled ? liveStats : relayStats;

  const statCards = [
    { icon: ArrowUpDown, color: '#3b82f6', value: stats.packetsForwarded, label: 'Packets Forwarded' },
    { icon: Activity, color: '#a855f7', value: formatBytes(stats.bytesRelayed), label: 'Data Relayed' },
    { icon: Zap, color: '#eab308', value: stats.activeCircuits, label: 'Active Circuits' },
    { icon: Clock, color: '#9ca3af', value: formatUptime(stats.uptime), label: 'Uptime' },
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: '#111827', border: '1px solid rgba(55,65,81,0.5)', maxHeight: '90vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Radio size={20} color={isRelayEnabled ? '#10b981' : '#6b7280'} />
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>Relay Node</Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#9ca3af' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0 }}>
        {/* Toggle */}
        <Paper
          elevation={0}
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: 3, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)', mb: 2.5 }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Enable Relay</Typography>
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem' }}>
              Help others communicate privately by relaying encrypted packets
            </Typography>
          </Box>
          <Switch
            checked={isRelayEnabled}
            onChange={(_, checked) => onToggleRelay(checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' },
            }}
          />
        </Paper>

        {/* Status */}
        <Paper
          elevation={0}
          sx={{
            textAlign: 'center',
            py: 2.5,
            borderRadius: 3,
            bgcolor: isRelayEnabled ? 'rgba(16,185,129,0.08)' : 'rgba(31,41,55,0.2)',
            border: isRelayEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(55,65,81,0.2)',
            mb: 2.5,
          }}
        >
          <Radio
            size={32}
            color={isRelayEnabled ? '#10b981' : '#4b5563'}
            style={isRelayEnabled ? { animation: 'pulse 2s infinite' } : undefined}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, color: isRelayEnabled ? '#6ee7b7' : '#6b7280', mt: 1 }}>
            {isRelayEnabled ? 'Relay Active' : 'Relay Inactive'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.7rem' }}>
            {isRelayEnabled ? 'You are helping the network. Thank you!' : 'Enable to contribute to the network'}
          </Typography>
        </Paper>

        {/* Stats Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
          {statCards.map((s) => (
            <Paper
              key={s.label}
              elevation={0}
              sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)' }}
            >
              <s.icon size={16} color={s.color} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', mt: 0.5, fontSize: '1.1rem' }}>
                {s.value}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '0.65rem' }}>
                {s.label}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* Reputation */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Star size={16} color="#eab308" />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>Reputation Score</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#10b981' }}>{stats.reputationScore}/100</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={stats.reputationScore}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#1f2937',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #10b981, #14b8a6)', borderRadius: 4 },
            }}
          />
        </Paper>

        {/* Bandwidth Limit */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(31,41,55,0.2)', border: '1px solid rgba(55,65,81,0.2)', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Gauge size={16} color="#f97316" />
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>Bandwidth Limit</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#d1d5db', fontFamily: 'monospace', fontSize: '0.8rem' }}>{bandwidthLimit} KB/s</Typography>
          </Box>
          <Slider
            value={bandwidthLimit}
            onChange={handleBandwidthChange}
            min={128}
            max={10240}
            step={128}
            sx={{ color: '#10b981' }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '0.65rem' }}>128 KB/s</Typography>
            <Typography variant="caption" sx={{ color: '#4b5563', fontSize: '0.65rem' }}>10 MB/s</Typography>
          </Box>
        </Paper>

        {/* Info */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(31,41,55,0.1)', border: '1px solid rgba(55,65,81,0.2)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Shield size={16} color="#10b981" />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#d1d5db', fontSize: '0.85rem' }}>How Relay Nodes Work</Typography>
          </Box>
          {[
            'Relay nodes forward encrypted packets between peers',
            'You cannot read any of the relayed content (onion encryption)',
            'Higher reputation = trusted by more peers',
            'Bandwidth throttling prevents abuse',
            'Rate limiting protects against flooding attacks',
          ].map((text) => (
            <Typography key={text} variant="caption" sx={{ color: '#6b7280', display: 'block', fontSize: '0.7rem', pl: 1, mb: 0.5 }}>
              &bull; {text}
            </Typography>
          ))}
        </Paper>
      </DialogContent>
    </Dialog>
  );
}
