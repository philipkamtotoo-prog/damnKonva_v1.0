'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  iconLeft?:  React.ReactNode;
  iconRight?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent',
  secondary: 'bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200',
  danger:    'bg-red-50   hover:bg-red-100   text-red-600   border border-transparent',
  ghost:     'bg-transparent hover:bg-zinc-100 text-zinc-600 border border-transparent',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3   text-base gap-2',
};

export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  iconLeft,
  iconRight,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base = [
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  ].join(' ');

  return (
    <button className={base} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="animate-spin">⟳</span>
      ) : iconLeft ? (
        <span className="flex-shrink-0">{iconLeft}</span>
      ) : null}
      {children}
      {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
}
