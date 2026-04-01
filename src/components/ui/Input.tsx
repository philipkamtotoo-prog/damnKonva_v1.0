'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:     string;
  error?:     string;
  hint?:      string;
  iconLeft?:  React.ReactNode;
}

export function Input({ label, error, hint, iconLeft, className = '', id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-zinc-600">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            {iconLeft}
          </span>
        )}
        <input
          id={inputId}
          className={[
            'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900',
            'placeholder:text-zinc-400',
            'focus:outline-none focus:ring-1',
            error
              ? 'border-red-500   focus:ring-red-500   focus:border-red-500'
              : 'border-zinc-200  focus:ring-emerald-500 focus:border-emerald-500',
            iconLeft ? 'pl-9' : '',
            className,
          ].join(' ')}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint  && !error && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?:  string;
}

export function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const taId = id || `ta-${Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={taId} className="text-xs font-semibold text-zinc-600">
          {label}
        </label>
      )}
      <textarea
        id={taId}
        className={[
          'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900',
          'placeholder:text-zinc-400 resize-none',
          'focus:outline-none focus:ring-1',
          error
            ? 'border-red-500   focus:ring-red-500   focus:border-red-500'
            : 'border-zinc-200  focus:ring-emerald-500 focus:border-emerald-500',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint  && !error && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
