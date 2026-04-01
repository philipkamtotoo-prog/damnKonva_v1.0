'use client';

import React, { useEffect, useRef, useCallback } from 'react';

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  description?: string;
  children:   React.ReactNode;
  footer?:    React.ReactNode;
  size?:      'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef  = useRef<HTMLDivElement>(null);
  const titleId    = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);
  const prevFocus  = useRef<HTMLElement | null>(null);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    return () => {
      prevFocus.current?.focus?.();
    };
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first?.focus();
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId.current : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative bg-white rounded-xl shadow-2xl w-full ${sizeMap[size]} flex flex-col`}
        style={{ animation: 'scaleIn 0.2s ease-out' }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-0">
            <div>
              <h2 id={titleId.current} className="text-base font-semibold text-zinc-800">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-zinc-500">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="关闭弹窗"
              className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors text-xl leading-none p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >✕</button>
          </div>
        )}

        {/* Body */}
        <div className={`px-6 py-5 ${!title ? 'pt-8' : ''}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
