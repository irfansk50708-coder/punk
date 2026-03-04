// ============================================================
// Add Contact Modal - QR Code + manual import
// ============================================================

'use client';

import { useState } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  UserPlus,
  Scan,
  Link2,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { cn } from '@/lib/utils';
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
}

export default function AddContactModal({
  identity,
  onAddContact,
  onClose,
}: AddContactModalProps) {
  const [tab, setTab] = useState<'share' | 'add'>('share');
  const [copied, setCopied] = useState(false);
  const [contactData, setContactData] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  // Generate share data
  const shareData = JSON.stringify({
    id: identity.id,
    displayName: identity.displayName,
    publicKey: identity.publicKey,
    encryptionPublicKey: identity.encryptionPublicKey,
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = async () => {
    if (!contactData.trim()) {
      setError('Please paste the contact data');
      return;
    }

    setIsAdding(true);
    setError('');

    try {
      const parsed = JSON.parse(contactData.trim());

      if (!parsed.id || !parsed.publicKey || !parsed.encryptionPublicKey) {
        throw new Error('Invalid contact data');
      }

      if (parsed.id === identity.id) {
        throw new Error("You can't add yourself as a contact");
      }

      await onAddContact({
        id: parsed.id,
        displayName: parsed.displayName || displayName || 'Unknown',
        publicKey: parsed.publicKey,
        encryptionPublicKey: parsed.encryptionPublicKey,
      });

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid contact data. Please check and try again.';
      setError(message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">Add Contact</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setTab('share')}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === 'share'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4" />
              Share My ID
            </div>
          </button>
          <button
            onClick={() => setTab('add')}
            className={cn(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === 'add'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Contact
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === 'share' ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm text-center">
                Share this QR code or your identity data with others so they can add you.
              </p>

              {/* QR Code */}
              <div className="flex justify-center p-6 bg-white rounded-xl">
                <QRCode
                  value={shareData}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              {/* Identity info */}
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500 text-xs">Your ID</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy All
                      </>
                    )}
                  </button>
                </div>
                <p className="text-gray-300 text-xs font-mono break-all">
                  {identity.id}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Paste the contact data shared by your friend.
              </p>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Contact Data (JSON)
                </label>
                <textarea
                  value={contactData}
                  onChange={(e) => {
                    setContactData(e.target.value);
                    setError('');
                  }}
                  placeholder='Paste contact JSON here...'
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Display Name (optional override)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Custom display name..."
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs">{error}</p>
              )}

              <button
                onClick={handleAdd}
                disabled={isAdding || !contactData.trim()}
                className={cn(
                  'w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all',
                  contactData.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                )}
              >
                <UserPlus className="w-4 h-4" />
                {isAdding ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
