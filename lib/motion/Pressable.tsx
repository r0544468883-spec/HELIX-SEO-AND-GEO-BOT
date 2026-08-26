'use client';
import React, { useCallback, useRef } from 'react';

type PressableProps<T extends React.ElementType> = {
  as?: T;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'children'>;

/**
 * Instant press feedback on pointer-DOWN, not on release (skill §1). Waiting for
 * click to show feedback feels dead. Wraps any element/component.
 *
 *   <Pressable as="button" className="btn" onClick={...}>Send</Pressable>
 */
export function Pressable<T extends React.ElementType = 'button'>({
  as,
  children,
  ...rest
}: PressableProps<T>) {
  const Comp = (as || 'button') as React.ElementType;
  const ref = useRef<HTMLElement>(null);

  const down = useCallback(() => ref.current?.setAttribute('data-pressed', 'true'), []);
  const up = useCallback(() => ref.current?.setAttribute('data-pressed', 'false'), []);

  return (
    <Comp
      ref={ref as never}
      data-pressed="false"
      className={['hm-pressable', (rest as { className?: string }).className].filter(Boolean).join(' ')}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      {...(rest as object)}
    >
      {children}
    </Comp>
  );
}
