import { useCallback, useEffect } from 'react';
import type { AnimationEvent, RefObject } from 'react';
import { getCloseAnimationDurationMs, getCloseFallbackDelayMs } from '../shared/animationDuration';
import type { ModalAdapterProps } from '../shared/types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Shares exit timing while leaving native dialog closure to its adapter. */
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
