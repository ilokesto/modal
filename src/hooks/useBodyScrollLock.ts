import { useEffect } from 'react';

const overflowProperties = ['overflow', 'overflow-x', 'overflow-y'] as const;
let ownerCount = 0;
let originalOverflow: Array<{ property: string; value: string; priority: string }> = [];

/**
 * @description Locks body scrolling while any mounted modal owns a lock, including closing modals. Restores the original inline overflow declarations and priorities after the last owner unmounts.
 * @example
 * ```tsx
 * function ModalSurface() {
 *   useBodyScrollLock();
 *   return <section>Settings</section>;
 * }
 * ```
 */
export function useBodyScrollLock() {
  useEffect(() => {
    const style = document.body.style;
    if (ownerCount === 0) {
      originalOverflow = overflowProperties.map((property) => ({
        property,
        value: style.getPropertyValue(property),
        priority: style.getPropertyPriority(property),
      }));
      style.setProperty('overflow', 'hidden', 'important');
    }
    ownerCount++;

    return () => {
      ownerCount--;
      if (ownerCount === 0) {
        for (const property of overflowProperties) {
          style.removeProperty(property);
        }
        for (const { property, value, priority } of originalOverflow) {
          if (value !== '') {
            style.setProperty(property, value, priority);
          }
        }
        originalOverflow = [];
      }
    };
  }, []);
}
