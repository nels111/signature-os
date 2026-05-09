'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = '500px' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full mx-4"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#e2e8f0' }}>
          <h2 className="text-lg font-semibold" style={{ color: '#1a1a1a' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
