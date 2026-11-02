import { useCallback, useEffect } from 'react';
import type { AnimationEvent, RefObject } from 'react';
import { getCloseAnimationDurationMs, getCloseFallbackDelayMs } from '../shared/animationDuration';
import type { ModalAdapterProps } from '../shared/types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * @description Shares exit timing without closing native dialogs itself. Reduced motion exits immediately; otherwise a panel animation end or bounded fallback invokes onExit.
 * @param {RefObject<TElement>} elementRef - Animated panel used to read its inline animation duration.
 * @param {'open' | 'closing'} status - Overlay lifecycle status controlling exit.
 * @param {() => void} onExit - Adapter cleanup callback; callers must tolerate repeated completion signals.
 * @returns {object} Exit state and event handler.
 * - prefersReducedMotion `boolean` - Whether entry and exit motion should be disabled.
 * - handleAnimationEnd `(event: AnimationEvent<TElement>) => void` - Completes a closing panel's own animation, ignoring bubbled child events.
 * @example
 * ```tsx
 * const { handleAnimationEnd } = useModalExit(panelRef, status, remove);
 * return <div ref={panelRef} onAnimationEnd={handleAnimationEnd}>{children}</div>;
 * ```
 */
export function useModalExit<TElement extends HTMLElement>(
  elementRef: RefObject<TElement>,
  status: ModalAdapterProps['status'],
  onExit: () => void,
) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (status === 'closing' && prefersReducedMotion) {
      onExit();
    }
  }, [status, prefersReducedMotion, onExit]);

  useEffect(() => {
    if (status !== 'closing' || prefersReducedMotion) {
      return;
    }
    const delay = getCloseFallbackDelayMs(getCloseAnimationDurationMs(elementRef.current));
    const timer = window.setTimeout(onExit, delay);
    return () => window.clearTimeout(timer);
  }, [status, prefersReducedMotion, elementRef, onExit]);

  const handleAnimationEnd = useCallback((event: AnimationEvent<TElement>) => {
    if (status === 'closing' && event.target === event.currentTarget) {
      onExit();
    }
  }, [status, onExit]);

  return { prefersReducedMotion, handleAnimationEnd };
}
