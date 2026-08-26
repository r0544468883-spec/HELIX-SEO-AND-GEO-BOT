'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import { createSpring, project, rubberband, SPRINGS, SpringController, VelocityTracker } from './spring';
import { useReducedMotion } from './useMotionPreference';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width of the sheet on wide screens. */
  maxWidth?: number;
  className?: string;
}

/**
 * Bottom sheet with the full Apple gesture stack:
 *  §2 1:1 drag glued to the finger (respects grab offset, Pointer Events + capture)
 *  §3 interruptible — grab it mid-animation and it follows immediately
 *  §5 velocity handoff — release velocity seeds the spring, no seam
 *  §6 momentum projection — a flick throws it to the projected snap point
 *  §9 rubber-band resistance past fully-open
 *  §12 frosted material + dimming scrim
 * Works with mouse, trackpad, touch, and pen (unified Pointer Events).
 */
export function Sheet({ open, onClose, children, maxWidth = 520, className }: SheetProps) {
  const reduce = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const anim = useRef<SpringController | null>(null);
  const state = useRef({ y: 0, OPEN: 0, CLOSED: 0, height: 0, dragging: false, startPointer: 0, startY: 0 });
  const tracker = useRef(new VelocityTracker());

  const measure = useCallback(() => {
    const h = surfaceRef.current?.offsetHeight ?? 0;
    state.current.height = h;
    state.current.CLOSED = 0;
    state.current.OPEN = -h;
  }, []);

  const setY = useCallback((y: number) => {
    const s = state.current;
    s.y = y;
    if (sheetRef.current) sheetRef.current.style.transform = `translate(-50%, ${y}px)`;
    const p = s.OPEN !== 0 ? Math.min(1, Math.max(0, y / s.OPEN)) : 0;
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.style.background = `rgba(var(--hm-scrim), ${(0.42 * p).toFixed(3)})`;
      const b = `blur(${(p * 6).toFixed(1)}px)`;
      scrim.style.setProperty('backdrop-filter', b);
      scrim.style.setProperty('-webkit-backdrop-filter', b);
      scrim.style.pointerEvents = p > 0.02 ? 'auto' : 'none';
    }
  }, []);

  const springTo = useCallback(
    (to: number, velocity = 0, cfg = SPRINGS.drawer, onRest?: () => void) => {
      anim.current?.cancel();
      anim.current = createSpring({ from: state.current.y, to, velocity, ...cfg, reduce, onUpdate: setY, onRest });
    },
    [reduce, setY]
  );

  // open / close driven by the `open` prop
  useEffect(() => {
    measure();
    if (open) {
      if (state.current.y === 0) setY(0.1);
      springTo(state.current.OPEN, 0, SPRINGS.drawer);
    } else {
      springTo(state.current.CLOSED, 0, SPRINGS.default);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // drag on the grabber
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    s.dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    anim.current?.cancel(); // §3 read live value, stop the spring
    s.startPointer = e.clientY;
    s.startY = s.y;
    tracker.current.reset();
    tracker.current.add(e.clientY, performance.now());
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    let y = s.startY + (e.clientY - s.startPointer); // §2 glued to finger
    if (y < s.OPEN) y = s.OPEN + rubberband(y - s.OPEN, s.height); // §9 resist past open
    if (y > s.CLOSED) y = s.CLOSED;
    setY(y);
    tracker.current.add(e.clientY, performance.now());
  }, [setY]);

  const onPointerUp = useCallback(() => {
    const s = state.current;
    if (!s.dragging) return;
    s.dragging = false;
    const v = tracker.current.velocity();                 // §5
    const projected = s.y + project(v);                    // §6
    const toOpen = projected < s.OPEN / 2;
    const target = toOpen ? s.OPEN : s.CLOSED;
    springTo(target, v, toOpen ? SPRINGS.drawer : SPRINGS.default, () => {
      if (!toOpen) onClose();
    });
  }, [onClose, springTo]);

  return (
    <>
      <div ref={scrimRef} className="hm-scrim" style={{ zIndex: 50 }} onClick={onClose} />
      <div
        ref={sheetRef}
        className={className}
        style={{
          position: 'fixed', left: '50%', top: '100%', zIndex: 60,
          width: `min(${maxWidth}px, 100%)`, transform: 'translate(-50%, 0)',
          willChange: 'transform', touchAction: 'none',
        }}
      >
        <div
          ref={surfaceRef}
          className="hm-material"
          style={{ borderRadius: '26px 26px 0 0', borderBottom: 0, padding: '10px 22px 30px', minHeight: '40vh', boxShadow: 'var(--hm-shadow)' }}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ width: 44, height: 5, borderRadius: 999, background: 'color-mix(in srgb, currentColor 22%, transparent)', margin: '8px auto 14px', cursor: 'grab', touchAction: 'none' }}
          />
          {children}
        </div>
      </div>
    </>
  );
}
