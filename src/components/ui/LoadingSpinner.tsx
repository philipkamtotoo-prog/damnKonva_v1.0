'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?:  'sm' | 'md' | 'lg';
  text?:  string;
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 text-sm',
  md: 'w-6 h-6 text-base',
  lg: 'w-8 h-8 text-xl',
};

export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`${sizeMap[size]} animate-spin text-emerald-600`} aria-hidden>
        ⟳
      </span>
      {text && <span className="text-sm text-zinc-500 animate-pulse">{text}</span>}
    </div>
  );
}
