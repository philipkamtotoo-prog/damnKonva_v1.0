'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?:   string | number;
  height?:  string | number;
}

export function Skeleton({
  className = '',
  variant   = 'rect',
  width,
  height,
}: SkeletonProps) {
  const base = 'bg-zinc-200 animate-pulse rounded';

  const variantClass = {
    text:    'h-3 w-full rounded',
    rect:    '',
    circle:  'rounded-full',
  }[variant];

  const style: React.CSSProperties = {
    width:  width  ?? (variant === 'circle' ? 40  : '100%'),
    height: height ?? (variant === 'text'  ? 12  : 80),
  };

  return <div className={`${base} ${variantClass} ${className}`} style={style} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-zinc-100">
      <Skeleton variant="text" height={14} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} variant="text" height={12} className="opacity-60" />
      ))}
    </div>
  );
}
