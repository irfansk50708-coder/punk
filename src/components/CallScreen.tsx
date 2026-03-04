// ============================================================
// Call Screen – MUI + Lucide
// ============================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Fade from '@mui/material/Fade';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { generateColor } from '@/lib/utils';
import type { Call, Contact } from '@/lib/types';
import { getWebRTCManager } from '@/lib/webrtc';

interface CallScreenProps {
  call: Call;
  contact: Contact | undefined;
  onEndCall: () => void;
}

export default function CallScreen({ call, contact, onEndCall }: CallScreenProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const displayName = contact?.displayName || call.receiverId.slice(0, 12) + '...';
  const isVideo = call.type === 'video';
  const webrtc = getWebRTCManager();

  useEffect(() => {
    if (call.status !== 'connected') return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [call.status]);

  useEffect(() => {
    const localStream = webrtc.getLocalStream();
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;

    const handleMediaStream = (event: { type: string; peerId: string; data?: unknown }) => {
      if (remoteVideoRef.current && event.data instanceof MediaStream) remoteVideoRef.current.srcObject = event.data;
    };
    webrtc.on('media-stream', handleMediaStream);
    return () => { webrtc.off('media-stream', handleMediaStream); };
  }, []);

  const toggleMute = () => { setIsMuted(!isMuted); webrtc.toggleAudio(!isMuted); };
  const toggleVideo = () => { setIsVideoOff(!isVideoOff); webrtc.toggleVideo(!isVideoOff); };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (call.status) {
      case 'ringing': return 'Ringing...';
      case 'connecting': return 'Connecting...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
      case 'missed': return 'Missed call';
      case 'rejected': return 'Call rejected';
      default: return '';
    }
  };

  // Minimized PIP
  if (isMinimized) {
    return (
      <Fade in>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 50,
            borderRadius: 4,
            border: '1px solid rgba(55,65,81,0.5)',
            bgcolor: '#111827',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar sx={{ width: 40, height: 40, bgcolor: generateColor(call.receiverId), fontWeight: 600 }}>
            {displayName[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>
              {displayName}
            </Typography>
            <Typography variant="caption" sx={{ color: '#10b981' }}>
              {getStatusText()}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
            <IconButton size="small" onClick={() => setIsMinimized(false)} sx={{ color: '#9ca3af' }}>
              <Maximize2 size={16} />
            </IconButton>
            <Fab size="small" onClick={onEndCall} sx={{ bgcolor: '#ef4444', color: '#fff', '&:hover': { bgcolor: '#dc2626' }, width: 36, height: 36 }}>
              <PhoneOff size={16} />
            </Fab>
          </Box>
        </Paper>
      </Fade>
    );
  }

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 50, bgcolor: '#030712', display: 'flex', flexDirection: 'column' }}>
      {/* Video / Voice Area */}
      {isVideo ? (
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#000' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

          {/* Local Video PIP */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: { xs: 120, md: 180 },
              height: { xs: 160, md: 240 },
              borderRadius: 4,
              overflow: 'hidden',
              border: '2px solid rgba(55,65,81,0.5)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              bgcolor: '#1f2937',
            }}
          >
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: isVideoOff ? 'none' : 'block' }} />
            {isVideoOff && (
              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <VideoOff size={32} color="#6b7280" />
              </Box>
            )}
          </Box>

          {/* Status Overlay */}
          {call.status !== 'connected' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar sx={{ width: 96, height: 96, bgcolor: generateColor(call.receiverId), fontSize: '2.5rem', fontWeight: 700, mx: 'auto', mb: 2 }}>
                  {displayName[0]?.toUpperCase()}
                </Avatar>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>{displayName}</Typography>
                <Typography variant="body2" sx={{ color: '#d1d5db', mt: 1, animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } } }}>
                  {getStatusText()}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #111827 0%, #030712 100%)' }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                width: 128,
                height: 128,
                bgcolor: generateColor(call.receiverId),
                fontSize: '3.5rem',
                fontWeight: 700,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                ...(call.status === 'connected' ? { boxShadow: '0 0 0 6px rgba(16,185,129,0.2)', animation: 'pulse 2s infinite' } : {}),
              }}
            >
              {displayName[0]?.toUpperCase()}
            </Avatar>
            {call.status === 'ringing' && (
              <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(16,185,129,0.3)', animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite', '@keyframes ping': { '0%': { transform: 'scale(1)', opacity: 1 }, '75%, 100%': { transform: 'scale(1.3)', opacity: 0 } } }} />
            )}
          </Box>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, mt: 3 }}>{displayName}</Typography>
          <Typography variant="body1" sx={{ color: call.status === 'connected' ? '#10b981' : '#9ca3af', mt: 1, fontSize: '1.1rem' }}>
            {getStatusText()}
          </Typography>
        </Box>
      )}

      {/* Controls */}
      <Box sx={{ bgcolor: 'rgba(3,7,18,0.9)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(55,65,81,0.3)', py: 3, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Fab
            size="medium"
            onClick={toggleMute}
            sx={{
              bgcolor: isMuted ? 'rgba(239,68,68,0.2)' : '#1f2937',
              color: isMuted ? '#ef4444' : '#fff',
              '&:hover': { bgcolor: isMuted ? 'rgba(239,68,68,0.3)' : '#374151' },
            }}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </Fab>

          {isVideo && (
            <Fab
              size="medium"
              onClick={toggleVideo}
              sx={{
                bgcolor: isVideoOff ? 'rgba(239,68,68,0.2)' : '#1f2937',
                color: isVideoOff ? '#ef4444' : '#fff',
                '&:hover': { bgcolor: isVideoOff ? 'rgba(239,68,68,0.3)' : '#374151' },
              }}
            >
              {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
            </Fab>
          )}

          <Fab size="medium" sx={{ bgcolor: '#1f2937', color: '#fff', '&:hover': { bgcolor: '#374151' } }}>
            <Volume2 size={22} />
          </Fab>

          <Fab
            size="large"
            onClick={onEndCall}
            sx={{
              bgcolor: '#ef4444',
              color: '#fff',
              '&:hover': { bgcolor: '#dc2626' },
              boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              width: 64,
              height: 64,
            }}
          >
            <PhoneOff size={28} />
          </Fab>

          <Fab
            size="medium"
            onClick={() => setIsMinimized(true)}
            sx={{ bgcolor: '#1f2937', color: '#fff', '&:hover': { bgcolor: '#374151' } }}
          >
            <Minimize2 size={22} />
          </Fab>
        </Box>
      </Box>
    </Box>
  );
}
