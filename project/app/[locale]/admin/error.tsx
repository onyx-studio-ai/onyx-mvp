'use client';

import { AlertTriangle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-700" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Admin Error</h2>
        <p className="text-gray-600 text-sm">Failed to load this section. Please try again.</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
