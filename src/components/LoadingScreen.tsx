// ============================================================
// Loading Screen
// ============================================================

'use client';

import { Shield, Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg shadow-emerald-500/20">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">PunkNet</h1>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Initializing secure channels...</span>
        </div>
      </div>
    </div>
  );
}
