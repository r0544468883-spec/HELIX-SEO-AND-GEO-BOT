'use client';
import { useEffect, useState } from 'react';

/**
 * Three independent accessibility signals the motion system must respect (skill §14).
 * Reduced motion does NOT mean no feedback — components cross-fade instead of spring.
 */
export interface MotionPreference {
  /** prefers-reduced-motion: reduce → replace slides/springs with opacity cross-fades. */
  reducedMotion: boolean;
  /** prefers-reduced-transparency: reduce → make frosted surfaces solid, drop blur. */
  reducedTransparency: boolean;
  /** prefers-contrast: more → near-solid backgrounds with a contrasting border. */
  moreContrast: boolean;
}

function read(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

export function useMotionPreference(): MotionPreference {
  const [pref, setPref] = useState<MotionPreference>({
    reducedMotion: false,
    reducedTransparency: false,
    moreContrast: false,
  });

  useEffect(() => {
    const queries = {
      reducedMotion: '(prefers-reduced-motion: reduce)',
      reducedTransparency: '(prefers-reduced-transparency: reduce)',
      moreContrast: '(prefers-contrast: more)',
    } as const;

    const mqls = Object.entries(queries).map(([key, q]) => {
      const mql = window.matchMedia(q);
      return { key: key as keyof MotionPreference, mql };
    });

    const update = () =>
      setPref({
        reducedMotion: read(queries.reducedMotion),
        reducedTransparency: read(queries.reducedTransparency),
        moreContrast: read(queries.moreContrast),
      });

    update();
    mqls.forEach(({ mql }) => mql.addEventListener('change', update));
    return () => mqls.forEach(({ mql }) => mql.removeEventListener('change', update));
  }, []);

  return pref;
}

/** Convenience: just the reduced-motion boolean. */
export function useReducedMotion(): boolean {
  return useMotionPreference().reducedMotion;
}
