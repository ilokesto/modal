const DEFAULT_CLOSE_ANIMATION_MS = 200;
const CLOSE_FALLBACK_BUFFER_MS = 50;

function parseDurationToken(token: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(token);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return match[2] === 's' ? value * 1000 : value;
}

/**
 * @description Reads the first supported inline animation duration in milliseconds. Missing elements or declarations use the 200 ms default; a shorthand with no duration yields zero. Computed styles are not consulted.
 * @param {HTMLElement | null} element - Closing panel, or null before mounting.
 * @returns {number} Inline animation duration in milliseconds or the documented fallback.
 * @example
 * ```ts
 * panel.style.animationDuration = "0.3s";
 * const durationMs = getCloseAnimationDurationMs(panel); // 300
 * ```
 */
export function getCloseAnimationDurationMs(element: HTMLElement | null): number {
  if (!element) {
    return DEFAULT_CLOSE_ANIMATION_MS;
  }

  const longhand = parseDurationToken(element.style.animationDuration);
  if (longhand !== null) {
    return longhand;
  }

  const shorthand = element.style.animation;
  if (shorthand) {
    for (const token of shorthand.split(/\s+/)) {
      const parsed = parseDurationToken(token);
      if (parsed !== null) {
        return parsed;
      }
    }
    return 0;
  }

  return DEFAULT_CLOSE_ANIMATION_MS;
}

/**
 * @description Adds a 50 ms safety buffer to a positive animation duration; nonpositive durations exit without delay.
 * @param {number} durationMs - Animation duration in milliseconds.
 * @returns {number} Fallback timeout delay in milliseconds.
 * @example
 * ```ts
 * const delay = getCloseFallbackDelayMs(200); // 250
 * ```
 */
export function getCloseFallbackDelayMs(durationMs: number): number {
  return durationMs > 0 ? durationMs + CLOSE_FALLBACK_BUFFER_MS : 0;
}
