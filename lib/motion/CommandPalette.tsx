'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSpring, SpringController } from './spring';
import { useReducedMotion } from './useMotionPreference';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  /** Open/close with Cmd/Ctrl+K globally (default true). Parent still owns `open`. */
  hotkey?: boolean;
  onOpen?: () => void;
}

/**
 * ⌘K / Ctrl+K command palette — the most desktop-native primitive. Scales in from
 * the top with a spring (§4), scrim blur (§12), live fuzzy filter, full keyboard
 * nav (↑/↓/Enter/Esc). Entirely keyboard + mouse; no touch gesture involved.
 */
export function CommandPalette({ open, onClose, items, placeholder = 'חיפוש…', hotkey = true, onOpen }: CommandPaletteProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anim = useRef<SpringController | null>(null);
  const s = useRef(0.9);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? items.filter((i) => (i.title + ' ' + (i.subtitle ?? '') + ' ' + (i.keywords ?? '')).toLowerCase().includes(query))
      : items;
    return list.slice(0, 8);
  }, [q, items]);

  const draw = useCallback((v: number) => {
    s.current = v;
    const wrap = wrapRef.current;
    if (wrap) {
      wrap.style.transform = `translateX(-50%) scale(${v})`;
      wrap.style.opacity = String(Math.max(0, Math.min(1, (v - 0.9) / 0.1)));
    }
    const scrim = scrimRef.current;
    if (scrim) {
      const t = Math.max(0, Math.min(1, (v - 0.9) / 0.1));
      scrim.style.background = `rgba(var(--hm-scrim), ${(0.4 * t).toFixed(3)})`;
      const b = `blur(${(t * 40).toFixed(1)}px)`;
      scrim.style.setProperty('backdrop-filter', b);
      scrim.style.setProperty('-webkit-backdrop-filter', b);
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (open) {
      setQ(''); setSel(0);
      wrap.style.display = 'block';
      if (scrimRef.current) scrimRef.current.style.pointerEvents = 'auto';
      setTimeout(() => inputRef.current?.focus(), 0);
      anim.current?.cancel();
      anim.current = createSpring({ from: s.current, to: 1, damping: 0.85, response: 0.32, reduce, onUpdate: draw });
    } else {
      anim.current?.cancel();
      anim.current = createSpring({
        from: s.current, to: 0.9, damping: 1, response: 0.26, reduce, onUpdate: draw,
        onRest: () => { if (wrap) wrap.style.display = 'none'; if (scrimRef.current) scrimRef.current.style.pointerEvents = 'none'; },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // global hotkey + in-palette keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hotkey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open ? onClose() : onOpen?.();
        return;
      }
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => (i + 1) % Math.max(1, filtered.length)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length)); }
      if (e.key === 'Enter') { const it = filtered[sel]; if (it) { it.run(); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hotkey, filtered, sel, onClose, onOpen]);

  return (
    <>
      <div ref={scrimRef} className="hm-scrim" style={{ zIndex: 60 }} onClick={onClose} />
      <div
        ref={wrapRef}
        style={{
          position: 'fixed', top: '16%', left: '50%', zIndex: 70, width: 'min(560px, 92vw)',
          transform: 'translateX(-50%) scale(0.9)', transformOrigin: '50% 0', display: 'none', opacity: 0,
          willChange: 'transform, opacity',
        }}
      >
        <div className="hm-material" style={{ borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--hm-shadow)' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder={placeholder}
            style={{ width: '100%', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', fontSize: 17, padding: '18px 20px', outline: 'none' }}
          />
          <div style={{ maxHeight: 280, overflow: 'auto', borderTop: '1px solid var(--hm-border)' }}>
            {filtered.map((it, i) => (
              <div
                key={it.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => { it.run(); onClose(); }}
                style={{
                  padding: '12px 20px', fontSize: 14.5, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                  background: i === sel ? 'color-mix(in srgb, var(--hm-accent) 12%, transparent)' : 'transparent',
                }}
              >
                <span>{it.title}</span>
                {it.subtitle && <small style={{ color: 'var(--hm-ink-muted, #888)', marginInlineStart: 'auto' }}>{it.subtitle}</small>}
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '16px 20px', opacity: 0.6, fontSize: 14 }}>אין תוצאות</div>}
          </div>
        </div>
      </div>
    </>
  );
}
