'use client';
import React, { forwardRef } from 'react';

interface ScrimProps {
  onClick?: () => void;
  /** 0..1 dim + blur amount. Drive this from a sheet/drawer's progress. */
  progress?: number;
  maxOpacity?: number;
  maxBlur?: number;
  style?: React.CSSProperties;
}

/**
 * The dimming/blur layer behind a modal task (skill §12: "dim to focus"). Pushes
 * the background back so the surface reads as a separate layer. Use progress to
 * keep it 1:1 with a dragged sheet.
 */
export const Scrim = forwardRef<HTMLDivElement, ScrimProps>(function Scrim(
  { onClick, progress = 0, maxOpacity = 0.42, maxBlur = 6, style },
  ref
) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div
      ref={ref}
      className="hm-scrim"
      onClick={onClick}
      style={{
        background: `rgba(var(--hm-scrim), ${(maxOpacity * p).toFixed(3)})`,
        backdropFilter: `blur(${(maxBlur * p).toFixed(1)}px)`,
        WebkitBackdropFilter: `blur(${(maxBlur * p).toFixed(1)}px)`,
        pointerEvents: p > 0.02 ? 'auto' : 'none',
        zIndex: 50,
        ...style,
      }}
    />
  );
});
