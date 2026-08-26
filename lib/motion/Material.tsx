'use client';
import React from 'react';

type MaterialProps<T extends React.ElementType> = {
  as?: T;
  /** Bigger surfaces read as thicker material (skill §12): stronger blur + deeper shadow. */
  weight?: 'thin' | 'regular' | 'thick';
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children'>;

const BLUR = { thin: 12, regular: 24, thick: 30 } as const;

/**
 * A translucent frosted layer (skill §12). Build nav/toolbars/sheets as material
 * with content scrolling underneath — never opaque bars. Respects
 * prefers-reduced-transparency automatically via the .hm-material class.
 */
export function Material<T extends React.ElementType = 'div'>({
  as,
  weight = 'regular',
  children,
  style,
  ...rest
}: MaterialProps<T>) {
  const Comp = (as || 'div') as React.ElementType;
  return (
    <Comp
      className={['hm-material', (rest as { className?: string }).className].filter(Boolean).join(' ')}
      style={{ ['--hm-blur' as string]: `${BLUR[weight]}px`, ...(style as object) }}
      {...(rest as object)}
    >
      {children}
    </Comp>
  );
}
