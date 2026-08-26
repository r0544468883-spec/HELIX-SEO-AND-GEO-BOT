'use client';
import { useLayoutEffect, useRef } from 'react';
import { createSpring, SPRINGS } from './spring';
import { useReducedMotion } from './useMotionPreference';

/**
 * FLIP reflow with springs — the desktop win (skill §4, §7 spatial consistency).
 * When a list/table reorders, rows FLOW to their new positions instead of jumping.
 * Pure state change, no gesture. Works with mouse, keyboard, anything.
 *
 * Usage:
 *   const listRef = useFlip<HTMLTableSectionElement>([sortKey, sortDir, rows]);
 *   return <tbody ref={listRef}>{rows.map(r => <tr key={r.id} data-flip-id={r.id}>…</tr>)}</tbody>;
 *
 * Each animated child MUST carry a stable `data-flip-id`. Animates transform only.
 */
export function useFlip<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const prev = useRef<Map<string, number>>(new Map());

  // capture positions BEFORE the DOM paints the new order
  const container = ref.current;
  if (container) {
    const map = new Map<string, number>();
    container.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => {
      map.set(el.dataset.flipId!, el.getBoundingClientRect().top);
    });
    prev.current = map;
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    el.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((child) => {
      const id = child.dataset.flipId!;
      const old = prev.current.get(id);
      if (old == null) return; // newly added — skip the FLIP (could fade instead)
      const now = child.getBoundingClientRect().top;
      const dy = old - now;
      if (!dy) return;
      child.style.willChange = 'transform';
      createSpring({
        from: dy, to: 0, ...SPRINGS.reflow, reduce,
        onUpdate: (v) => { child.style.transform = `translateY(${v}px)`; },
        onRest: () => { child.style.transform = ''; child.style.willChange = ''; },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
