// ============================================================
// Settings Panel
// ============================================================

'use client';

import { useState } from 'react';
import {
  X,
  Shield,
  Key,
  Trash2,
  Download,
  Upload,
  Copy,
  Check,
  Moon,
  Bell,
  Globe,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn, generateColor } from '@/lib/utils';
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
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
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
    if (
      confirm(
        'This will delete ALL your data including messages, contacts, and your identity. This cannot be undone. Are you sure?'
      )
    ) {
      await clearAllData();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-white font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile */}
          <div className="text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3"
              style={{ backgroundColor: generateColor(identity.id) }}
            >
              {identity.displayName[0]?.toUpperCase()}
            </div>
            <h3 className="text-white text-lg font-semibold">
              {identity.displayName}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-gray-500 text-xs font-mono">
                {identity.id.slice(0, 16)}...
              </p>
              <button
                onClick={handleCopyId}
                className="text-gray-500 hover:text-emerald-400 transition-colors"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* Security */}
          <div>
            <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Security
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-300 text-sm">End-to-End Encryption</span>
                </div>
                <span className="text-emerald-400 text-xs font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-300 text-sm">Forward Secrecy</span>
                </div>
                <span className="text-emerald-400 text-xs font-medium">Enabled</span>
              </div>
            </div>
          </div>

          {/* Data */}
          <div>
            <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-400" />
              Data Management
            </h4>
            <div className="space-y-2">
              <button
                onClick={handleExport}
                className="w-full flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg text-left hover:bg-gray-800/50 transition-colors"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-gray-300 text-sm">Export Data</p>
                  <p className="text-gray-600 text-xs">
                    Download all your messages and contacts
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* About */}
          <div>
            <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-400" />
              About
            </h4>
            <div className="p-3 bg-gray-800/30 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Version</span>
                <span className="text-gray-300">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Protocol</span>
                <span className="text-gray-300">PunkNet v1</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Encryption</span>
                <span className="text-gray-300">AES-256-GCM + ECDH</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Routing</span>
                <span className="text-gray-300">Onion (3-hop)</span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <button
              onClick={() => setShowDanger(!showDanger)}
              className="text-red-400 text-sm font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </button>

            {showDanger && (
              <div className="mt-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-red-300 text-sm mb-3">
                  This will permanently delete all your data including your identity,
                  keys, messages, and contacts.
                </p>
                <button
                  onClick={handleClearData}
                  className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete All Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
