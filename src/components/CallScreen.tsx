// ============================================================
// Call Screen - Voice and Video calling UI
// ============================================================

'use client';

import { useState, useRef, useEffect } from 'react';
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
  RotateCcw,
} from 'lucide-react';
import { cn, generateColor } from '@/lib/utils';
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

  // Call duration timer
  useEffect(() => {
    if (call.status !== 'connected') return;

    const timer = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [call.status]);

  // Set up video streams
  useEffect(() => {
    const localStream = webrtc.getLocalStream();
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    const handleMediaStream = (event: { type: string; peerId: string; data?: unknown }) => {
      if (remoteVideoRef.current && event.data instanceof MediaStream) {
        remoteVideoRef.current.srcObject = event.data;
      }
    };

    webrtc.on('media-stream', handleMediaStream);

    return () => {
      webrtc.off('media-stream', handleMediaStream);
    };
  }, []);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    webrtc.toggleAudio(!isMuted);
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    webrtc.toggleVideo(!isVideoOff);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (call.status) {
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Call ended';
      case 'missed':
        return 'Missed call';
      case 'rejected':
        return 'Call rejected';
      default:
        return '';
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ backgroundColor: generateColor(call.receiverId) }}
        >
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{displayName}</p>
          <p className="text-emerald-400 text-xs">{getStatusText()}</p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEndCall}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Video Area */}
      {isVideo ? (
        <div className="flex-1 relative bg-black">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Local Video PIP */}
          <div className="absolute top-4 right-4 w-32 h-44 md:w-48 md:h-64 rounded-2xl overflow-hidden border-2 border-gray-700 shadow-2xl bg-gray-900">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'w-full h-full object-cover',
                isVideoOff && 'hidden'
              )}
            />
            {isVideoOff && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <VideoOff className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </div>

          {/* Status Overlay */}
          {call.status !== 'connected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4"
                  style={{ backgroundColor: generateColor(call.receiverId) }}
                >
                  {displayName[0]?.toUpperCase()}
                </div>
                <p className="text-white text-xl font-semibold">{displayName}</p>
                <p className="text-gray-300 mt-2 animate-pulse">{getStatusText()}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Voice Call */
        <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="relative">
            <div
              className={cn(
                'w-32 h-32 rounded-full flex items-center justify-center text-white text-5xl font-bold shadow-2xl',
                call.status === 'connected' && 'ring-4 ring-emerald-500/30 animate-pulse'
              )}
              style={{ backgroundColor: generateColor(call.receiverId) }}
            >
              {displayName[0]?.toUpperCase()}
            </div>
            {call.status === 'ringing' && (
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
            )}
          </div>

          <h2 className="text-white text-2xl font-semibold mt-6">{displayName}</h2>
          <p
            className={cn(
              'text-lg mt-2',
              call.status === 'connected' ? 'text-emerald-400' : 'text-gray-400'
            )}
          >
            {getStatusText()}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-950/90 backdrop-blur-sm border-t border-gray-800/50 py-6 px-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all',
              isMuted
                ? 'bg-red-500/20 text-red-400'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            )}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {isVideo && (
            <button
              onClick={toggleVideo}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all',
                isVideoOff
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              )}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6" />
              ) : (
                <Video className="w-6 h-6" />
              )}
            </button>
          )}

          <button className="w-14 h-14 rounded-full bg-gray-800 text-white hover:bg-gray-700 flex items-center justify-center transition-all">
            <Volume2 className="w-6 h-6" />
          </button>

          <button
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-500/30"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="w-14 h-14 rounded-full bg-gray-800 text-white hover:bg-gray-700 flex items-center justify-center transition-all"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
