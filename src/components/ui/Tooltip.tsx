'use client';

import React, { useState, useRef } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content:     string;
  position?:   TooltipPosition;
  delay?:      number;
  children:    React.ReactNode;
}

const posMap: Record<TooltipPosition, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowMap: Record<TooltipPosition, string> = {
  top:    'top-full left-1/2 -translate-x-1/2 border-t-zinc-700 border-x-transparent border-b-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-700 border-x-transparent border-t-transparent',
  left:   'left-full top-1/2 -translate-y-1/2 border-l-zinc-700 border-y-transparent border-r-transparent',
  right:  'right-full top-1/2 -translate-y-1/2 border-r-zinc-700 border-y-transparent border-l-transparent',
};

export function Tooltip({
  content,
  position = 'top',
  delay     = 300,
  children,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          className={`absolute ${posMap[position]} z-50 pointer-events-none`}
          style={{ animation: 'fadeInScale 0.15s ease-out' }}
        >
          <span className={`block bg-zinc-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap`}>
            {content}
          </span>
          <span
            className={`absolute w-0 h-0 border-4 ${arrowMap[position]}`}
          />
        </div>
      )}
      <style jsx global>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: translateX(-50%) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
