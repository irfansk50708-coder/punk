// ============================================================
// Setup Screen - Identity creation with key generation
// ============================================================

'use client';

import { useState } from 'react';
import {
  Shield,
  Key,
  Fingerprint,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupScreenProps {
  onComplete: (displayName: string) => Promise<void>;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const steps = [
    { icon: Key, label: 'Generating encryption keys...' },
    { icon: Fingerprint, label: 'Creating identity fingerprint...' },
    { icon: Shield, label: 'Securing your account...' },
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
      // Animate through steps
      for (let i = 0; i < steps.length; i++) {
        setStep(i);
        await new Promise((r) => setTimeout(r, 600));
      }

      await onComplete(displayName.trim());
    } catch (err) {
      setError('Failed to create identity. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/20">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">PunkNet</h1>
          <p className="text-gray-400 text-sm">
            Decentralized · Encrypted · Private
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800 p-6 shadow-2xl">
          {!isCreating ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">
                Create Your Identity
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Your identity is generated locally using cryptographic keys.
                No servers, no accounts, no tracking.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter your name..."
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                    maxLength={32}
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-400 text-xs mt-2">{error}</p>
                  )}
                </div>

                <button
                  onClick={handleCreate}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                >
                  Generate Keys & Create Identity
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Info Cards */}
              <div className="mt-6 space-y-3">
                {[
                  {
                    icon: Key,
                    title: 'End-to-End Encrypted',
                    desc: 'Messages are encrypted with AES-256-GCM',
                  },
                  {
                    icon: Shield,
                    title: 'No Central Server',
                    desc: 'Direct peer-to-peer communication',
                  },
                  {
                    icon: Fingerprint,
                    title: 'Cryptographic Identity',
                    desc: 'Public/private key pair authentication',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/30"
                  >
                    <item.icon className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Creating Animation */
            <div className="py-8">
              <div className="space-y-4">
                {steps.map((s, i) => {
                  const StepIcon = s.icon;
                  const isActive = i === step;
                  const isDone = i < step;

                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg transition-all duration-500',
                        isActive && 'bg-emerald-500/10 border border-emerald-500/20',
                        isDone && 'opacity-60',
                        !isActive && !isDone && 'opacity-30'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          isActive && 'bg-emerald-500 text-white',
                          isDone && 'bg-emerald-500/20 text-emerald-400',
                          !isActive && !isDone && 'bg-gray-800 text-gray-500'
                        )}
                      >
                        {isActive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isActive && 'text-emerald-300',
                          isDone && 'text-gray-400',
                          !isActive && !isDone && 'text-gray-600'
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          All data is stored locally on your device. Nothing leaves your browser unencrypted.
        </p>
      </div>
    </div>
  );
}
