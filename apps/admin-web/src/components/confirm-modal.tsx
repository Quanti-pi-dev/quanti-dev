'use client';

// ─── Confirm Modal ────────────────────────────────────────────
// Drop-in replacement for window.confirm() with proper styling.
// Supports a custom destructive label, loading state, and error display.

import { X, AlertTriangle } from 'lucide-react';
import { ErrorBanner } from './page-shell';

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Set true to render the confirm button in red (destructive actions) */
  destructive?: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          {destructive && (
            <div className="w-9 h-9 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center shrink-0">
              <AlertTriangle size={15} className="text-red-400" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              <button
                onClick={onCancel}
                className="text-zinc-500 hover:text-white transition -mt-0.5"
              >
                <X size={15} />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-white transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition disabled:opacity-50 ${
              destructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
