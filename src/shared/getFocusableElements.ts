const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Preserves the adapters' shared focus candidate policy and DOM order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => {
    if (element.tabIndex < 0 || element.matches(':disabled, input[type="hidden"]')) {
      return false;
    }

    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.display === 'contents') {
      return false;
    }

    // Geometry is unavailable in jsdom; opacity also changes during the entry animation.
    let inheritsInert = true;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (
        ancestor.matches('[hidden], [aria-hidden="true"]') ||
        (inheritsInert && ancestor.hasAttribute('inert'))
      ) {
        return false;
      }

      const ancestorStyle = getComputedStyle(ancestor);
      if (
        ancestorStyle.display === 'none' ||
        (ancestor !== element && ancestorStyle.contentVisibility === 'hidden')
      ) {
        return false;
      }

      // The top-layer adapter calls showModal() before selecting candidates.
      // A modal dialog escapes inherited inertness, but not inert on the dialog itself.
      if (ancestor === container && container.matches('dialog[open]')) {
        inheritsInert = false;
      }
    }

    return true;
  });
}
