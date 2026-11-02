import { useEffect, useState } from 'react';

const mediaQueryText = '(prefers-reduced-motion: reduce)';

interface LegacyMediaQueryList {
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
}

function getInitialPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(mediaQueryText).matches;
}

/**
 * @description Tracks the reduced-motion media preference, falling back to false when matchMedia is unavailable and supporting legacy media listeners.
 * @returns {boolean} Whether the user currently requests reduced motion.
 * @example
 * ```tsx
 * const reducedMotion = usePrefersReducedMotion();
 * const duration = reducedMotion ? "0s" : "0.2s";
 * ```
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(mediaQueryText);
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);

      return () => mediaQuery.removeEventListener('change', updatePreference);
    }

    const legacyMediaQuery = mediaQuery as LegacyMediaQueryList;
    legacyMediaQuery.addListener?.(updatePreference);

    return () => legacyMediaQuery.removeListener?.(updatePreference);
  }, []);

  return prefersReducedMotion;
}
