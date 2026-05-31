'use client';

import { Loader2, X, Check } from 'lucide-react';

interface Props {
  onCancel: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  label?: string;
  submitColor?: string;
}

export function FormActions({ onCancel, onSubmit, isSaving, label = 'Save outcome', submitColor = 'var(--brand-blue)' }: Props) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <X size={12} />
        Back
      </button>
      <button
        onClick={onSubmit}
        disabled={isSaving}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: submitColor }}
      >
        {isSaving ? (
          <><Loader2 size={12} className="animate-spin" /> Saving...</>
        ) : (
          <><Check size={12} /> {label}</>
        )}
      </button>
    </div>
  );
}
