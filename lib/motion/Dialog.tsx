'use client';
import React, { useCallback, useEffect, useRef } from 'react';
import { createSpring, SPRINGS, SpringController } from './spring';
import { useReducedMotion } from './useMotionPreference';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Element the dialog should scale FROM (skill §7: anchor to the trigger). */
  originRef?: React.RefObject<HTMLElement>;
  width?: number;
  className?: string;
}

/**
 * Modal dialog that scales in from its trigger's origin (skill §7 spatial
 * consistency) — not generically from the center — with a dimming scrim (§12).
 * Spring, interruptible, Escape + scrim-click to close. Keyboard/mouse driven.
 *
 * Implementation mirrors the verified reference: on open we position the wrapper
 * at the viewport center via left/top, set transform-origin relative to the
 * trigger, and animate ONLY scale + opacity (compositor-friendly).
 */
export function Dialog({ open, onClose, children, originRef, width = 420, className }: DialogProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const anim = useRef<SpringController | null>(null);
  const s = useRef(0.6);

  const draw = useCallback((v: number) => {
    s.current = v;
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.style.transform = `scale(${v})`;
      wrap.style.opacity = String(Math.max(0, Math.min(1, (v - 0.6) / 0.3)));
    }
    const scrim = scrimRef.current;
    if (scrim) {
      const t = Math.max(0, Math.min(1, (v - 0.6) / 0.4));
      scrim.style.background = `rgba(var(--hm-scrim), ${(0.42 * t).toFixed(3)})`;
      const b = `blur(${(t * 10).toFixed(1)}px)`;
      scrim.style.setProperty('backdrop-filter', b);
      scrim.style.setProperty('-webkit-backdrop-filter', b);
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (open) {
      wrap.style.display = 'block';
      wrap.style.transform = `scale(${s.current})`;
      const mr = wrap.getBoundingClientRect();
      const cx = window.innerWidth / 2 - mr.width / 2;
      const cy = window.innerHeight / 2 - mr.height / 2;
      wrap.style.left = `${cx}px`;
      wrap.style.top = `${cy}px`;
      const o = originRef?.current?.getBoundingClientRect();
      wrap.style.transformOrigin = o
        ? `${o.left + o.width / 2 - cx}px ${o.top + o.height / 2 - cy}px`
        : '50% 50%';
      if (scrimRef.current) scrimRef.current.style.pointerEvents = 'auto';
      anim.current?.cancel();
      anim.current = createSpring({ from: s.current, to: 1, ...SPRINGS.modal, reduce, onUpdate: draw });
    } else {
      anim.current?.cancel();
      anim.current = createSpring({
        from: s.current, to: 0.6, damping: 1, response: 0.28, reduce, onUpdate: draw,
        onRest: () => {
          if (wrap) wrap.style.display = 'none';
          if (scrimRef.current) scrimRef.current.style.pointerEvents = 'none';
        },
      });
    }
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
      <div ref={scrimRef} className="hm-scrim" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        ref={wrapRef}
        className={['hm-material', className].filter(Boolean).join(' ')}
        style={{
          position: 'fixed', left: 0, top: 0, zIndex: 70,
          width: `min(${width}px, 92vw)`, display: 'none', opacity: 0,
          transform: 'scale(0.6)', willChange: 'transform, opacity', boxShadow: 'var(--hm-shadow)',
        }}
      >
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </>
  );
}
