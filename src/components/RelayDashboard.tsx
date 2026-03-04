// ============================================================
// Relay Node Dashboard
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Activity,
  Zap,
  Shield,
  ArrowUpDown,
  Clock,
  Star,
  ToggleLeft,
  ToggleRight,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RelayStats } from '@/lib/types';
import { getRelayManager } from '@/lib/relay';

interface RelayDashboardProps {
  isRelayEnabled: boolean;
  relayStats: RelayStats;
  onToggleRelay: (enabled: boolean) => void;
  onClose: () => void;
}

export default function RelayDashboard({
  isRelayEnabled,
  relayStats,
  onToggleRelay,
  onClose,
}: RelayDashboardProps) {
  const [bandwidthLimit, setBandwidthLimit] = useState(1024);
  const [liveStats, setLiveStats] = useState<RelayStats>(relayStats);

  // Update stats periodically when relay is active
  useEffect(() => {
    if (!isRelayEnabled) return;

    const timer = setInterval(() => {
      const relay = getRelayManager();
      setLiveStats(relay.getStats());
    }, 1000);

    return () => clearInterval(timer);
  }, [isRelayEnabled]);

  const handleBandwidthChange = (value: number) => {
    setBandwidthLimit(value);
    const relay = getRelayManager();
    relay.setBandwidthLimit(value);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Radio className={cn('w-5 h-5', isRelayEnabled ? 'text-emerald-400' : 'text-gray-500')} />
            <h2 className="text-white font-semibold">Relay Node</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl">
            <div>
              <h3 className="text-white font-medium">Enable Relay</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                Help others communicate privately by relaying encrypted packets
              </p>
            </div>
            <button
              onClick={() => onToggleRelay(!isRelayEnabled)}
              className={cn(
                'transition-colors',
                isRelayEnabled ? 'text-emerald-400' : 'text-gray-600'
              )}
            >
              {isRelayEnabled ? (
                <ToggleRight className="w-10 h-10" />
              ) : (
                <ToggleLeft className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Status */}
          <div
            className={cn(
              'text-center py-4 rounded-xl',
              isRelayEnabled
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-gray-800/30 border border-gray-800'
            )}
          >
            <Radio
              className={cn(
                'w-8 h-8 mx-auto mb-2',
                isRelayEnabled
                  ? 'text-emerald-400 animate-pulse'
                  : 'text-gray-600'
              )}
            />
            <p className={cn('font-medium', isRelayEnabled ? 'text-emerald-300' : 'text-gray-500')}>
              {isRelayEnabled ? 'Relay Active' : 'Relay Inactive'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isRelayEnabled
                ? 'You are helping the network. Thank you!'
                : 'Enable to contribute to the network'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <ArrowUpDown className="w-4 h-4 text-blue-400 mb-2" />
              <p className="text-white text-lg font-semibold">{stats.packetsForwarded}</p>
              <p className="text-gray-500 text-xs">Packets Forwarded</p>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <Activity className="w-4 h-4 text-purple-400 mb-2" />
              <p className="text-white text-lg font-semibold">{formatBytes(stats.bytesRelayed)}</p>
              <p className="text-gray-500 text-xs">Data Relayed</p>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <Zap className="w-4 h-4 text-yellow-400 mb-2" />
              <p className="text-white text-lg font-semibold">{stats.activeCircuits}</p>
              <p className="text-gray-500 text-xs">Active Circuits</p>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-xl">
              <Clock className="w-4 h-4 text-gray-400 mb-2" />
              <p className="text-white text-lg font-semibold">{formatUptime(stats.uptime)}</p>
              <p className="text-gray-500 text-xs">Uptime</p>
            </div>
          </div>

          {/* Reputation */}
          <div className="p-4 bg-gray-800/30 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-sm font-medium">Reputation Score</span>
              </div>
              <span className="text-emerald-400 font-semibold">{stats.reputationScore}/100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                style={{ width: `${stats.reputationScore}%` }}
              />
            </div>
          </div>

          {/* Bandwidth Limit */}
          <div className="p-4 bg-gray-800/30 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-orange-400" />
                <span className="text-white text-sm font-medium">Bandwidth Limit</span>
              </div>
              <span className="text-gray-300 text-sm font-mono">{bandwidthLimit} KB/s</span>
            </div>
            <input
              type="range"
              min="128"
              max="10240"
              step="128"
              value={bandwidthLimit}
              onChange={(e) => handleBandwidthChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>128 KB/s</span>
              <span>10 MB/s</span>
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-gray-800/20 rounded-xl border border-gray-800">
            <h4 className="text-gray-300 text-sm font-medium mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              How Relay Nodes Work
            </h4>
            <ul className="space-y-1.5 text-gray-500 text-xs">
              <li>• Relay nodes forward encrypted packets between peers</li>
              <li>• You cannot read any of the relayed content (onion encryption)</li>
              <li>• Higher reputation = trusted by more peers</li>
              <li>• Bandwidth throttling prevents abuse</li>
              <li>• Rate limiting protects against flooding attacks</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
