'use client';
import React, { useCallback, useRef } from 'react';
import { createSpring, project, rubberband, SPRINGS, VelocityTracker } from './spring';
import { useReducedMotion } from './useMotionPreference';

export interface ResizablePanelProps {
  children: React.ReactNode;
  min?: number;
  max?: number;
  initial?: number;
  /** Which side the drag handle sits on. In RTL 'start' = right. */
  handleSide?: 'start' | 'end';
  className?: string;
}

/**
 * A mouse-draggable side panel (dashboards, CRM, IDE-style splits) with the same
 * physics as an Apple scroll: 1:1 tracking (§2), rubber-band resistance at the
 * min/max bounds (§9), and momentum snap on release (§6). Pointer Events, so it
 * works with mouse and trackpad — this is the desktop face of "fluid".
 */
export function ResizablePanel({ children, min = 180, max = 520, initial = 300, handleSide = 'start', className }: ResizablePanelProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startW: 0 });
  const tracker = useRef(new VelocityTracker());
  const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  // dragging the handle rightward should grow or shrink depending on side + direction
  const grows = handleSide === 'start' ? (isRTL ? 1 : -1) : (isRTL ? -1 : 1);

  const setW = useCallback((w: number) => {
    if (panelRef.current) panelRef.current.style.flexBasis = `${w}px`;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { active: true, startX: e.clientX, startW: panelRef.current?.offsetWidth ?? initial };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    tracker.current.reset();
    tracker.current.add(e.clientX, performance.now());
    document.body.style.cursor = 'col-resize';
  }, [initial]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.active) return;
    let w = drag.current.startW + (e.clientX - drag.current.startX) * grows;
    if (w < min) w = min - rubberband(min - w, 300);
    if (w > max) w = max + rubberband(w - max, 300);
    setW(w);
    tracker.current.add(e.clientX, performance.now());
  }, [grows, min, max, setW]);

  const onPointerUp = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;
    document.body.style.cursor = '';
    const v = tracker.current.velocity() * grows;
    const cur = panelRef.current?.offsetWidth ?? initial;
    const target = Math.max(min, Math.min(max, cur + project(v)));
    createSpring({ from: cur, to: target, ...SPRINGS.momentum, reduce, onUpdate: setW });
  }, [grows, min, max, initial, reduce, setW]);

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ width: 8, cursor: 'col-resize', flex: '0 0 auto', touchAction: 'none', alignSelf: 'stretch', background: 'transparent' }}
    >
      <div style={{ width: 2, height: '100%', margin: '0 3px', borderRadius: 99, background: 'var(--hm-border)' }} />
    </div>
  );

  const panel = (
    <div
      ref={panelRef}
      className={className}
      style={{ flex: `0 0 ${initial}px`, minWidth: min, maxWidth: max, overflow: 'auto' }}
    >
      {children}
    </div>
  );

  return handleSide === 'start' ? <>{handle}{panel}</> : <>{panel}{handle}</>;
}
