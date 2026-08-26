'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import { createSpring, SPRINGS, SpringController } from './spring';
import { useReducedMotion } from './useMotionPreference';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Which edge it slides from. In RTL, 'start' = right, 'end' = left. */
  side?: 'start' | 'end';
  width?: number;
  className?: string;
}

/**
 * Side drawer for detail panels (CRM record, candidate details, settings).
 * Spring in/out, fully interruptible: toggle rapidly and it follows the target
 * from its live on-screen position instead of finishing the old animation (§3).
 * Enter and exit share the same path (§7 spatial consistency). Closes on scrim
 * click and Escape. Pure state-change motion — no gesture required (desktop-first).
 */
export function Drawer({ open, onClose, children, side = 'start', width = 400, className }: DrawerProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const anim = useRef<SpringController | null>(null);
  const p = useRef(100); // percent off-screen; 100 hidden, 0 open

  // resolve physical edge from logical side + document direction
  const isRTL = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const physicalRight = side === 'start' ? isRTL : !isRTL;
  const hiddenSign = physicalRight ? 1 : -1; // translateX% direction to hide

  const apply = useCallback((pct: number) => {
    p.current = pct;
    if (panelRef.current) panelRef.current.style.transform = `translateX(${pct * hiddenSign}%)`;
    const t = 1 - Math.abs(pct) / 100;
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.style.background = `rgba(var(--hm-scrim), ${(0.4 * t).toFixed(3)})`;
      const b = `blur(${(t * 5).toFixed(1)}px)`;
      scrim.style.setProperty('backdrop-filter', b);
      scrim.style.setProperty('-webkit-backdrop-filter', b);
      scrim.style.pointerEvents = t > 0.03 ? 'auto' : 'none';
    }
  }, [hiddenSign]);

  useEffect(() => {
    anim.current?.cancel();
    anim.current = createSpring({
      from: p.current, to: open ? 0 : 100, ...(open ? SPRINGS.drawer : SPRINGS.default),
      reduce, onUpdate: apply,
      onRest: () => { if (!open && scrimRef.current) scrimRef.current.style.pointerEvents = 'none'; },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div ref={scrimRef} className="hm-scrim" style={{ zIndex: 50 }} onClick={onClose} />
      <div
        ref={panelRef}
        className={className}
        style={{
          position: 'fixed', top: 0, [physicalRight ? 'right' : 'left']: 0, height: '100%',
          width: `min(${width}px, 86vw)`, zIndex: 60, transform: 'translateX(100%)', willChange: 'transform',
        }}
      >
        <div
          className="hm-material"
          style={{ height: '100%', padding: 22, boxShadow: physicalRight ? '-20px 0 60px rgba(0,0,0,.2)' : '20px 0 60px rgba(0,0,0,.2)' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
