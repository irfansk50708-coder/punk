// ============================================================
// Empty Chat State - shown when no conversation is selected
// ============================================================

'use client';

import { Shield, Lock, Radio, Globe } from 'lucide-react';

export default function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 p-8">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/10 mb-6">
          <Shield className="w-10 h-10 text-emerald-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">PunkNet Messenger</h2>
        <p className="text-gray-500 text-sm mb-8">
          Select a conversation or add a contact to start messaging securely.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 gap-3 text-left">
          {[
            {
              icon: Lock,
              title: 'End-to-End Encrypted',
              desc: 'Every message is encrypted with AES-256-GCM before leaving your device',
              color: 'text-emerald-400',
            },
            {
              icon: Globe,
              title: 'Peer-to-Peer',
              desc: 'Messages are sent directly between devices without central servers',
              color: 'text-blue-400',
            },
            {
              icon: Radio,
              title: 'Onion Routing',
              desc: 'Optional multi-hop routing hides your identity from the network',
              color: 'text-purple-400',
            },
            {
              icon: Shield,
              title: 'Forward Secrecy',
              desc: 'Each message uses an ephemeral key - past messages stay safe',
              color: 'text-orange-400',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-900/50 border border-gray-800/50"
            >
              <feature.icon className={`w-5 h-5 ${feature.color} mt-0.5 shrink-0`} />
              <div>
                <p className="text-gray-200 text-sm font-medium">{feature.title}</p>
                <p className="text-gray-600 text-xs">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
