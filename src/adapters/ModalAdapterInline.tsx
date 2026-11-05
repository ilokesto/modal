import React, { useEffect, useRef, useCallback } from 'react';
import { useModalStackInfo } from '../hooks/useIsTopModal';
import { useModalExit } from '../hooks/useModalExit';
import { getFocusableElements } from '../shared/getFocusableElements';
import type { ModalAdapterProps, ModalPosition } from '../shared/types';

function getPositionStyles(pos?: ModalPosition): React.CSSProperties {
  switch (pos) {
    case 'top': return { alignItems: 'flex-start', justifyContent: 'center', paddingTop: '2rem' };
    case 'bottom': return { alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '2rem' };
    case 'left': return { alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '2rem' };
    case 'right': return { alignItems: 'center', justifyContent: 'flex-end', paddingRight: '2rem' };
    case 'top-left': return { alignItems: 'flex-start', justifyContent: 'flex-start', padding: '2rem' };
    case 'top-right': return { alignItems: 'flex-start', justifyContent: 'flex-end', padding: '2rem' };
    case 'bottom-left': return { alignItems: 'flex-end', justifyContent: 'flex-start', padding: '2rem' };
    case 'bottom-right': return { alignItems: 'flex-end', justifyContent: 'flex-end', padding: '2rem' };
    case 'center':
    default: return { alignItems: 'center', justifyContent: 'center' };
  }
}

let scrollLockCount = 0;
let originalBodyOverflow = '';

interface ModalAdapterInlineProps<TResult> extends ModalAdapterProps<TResult> {
  isHostedInTopLayer?: boolean;
}

/**
 * @description Renders a fixed-position modal with scroll locking, provider-local focus containment and top-modal dismissal. A native host preserves inline presentation when a preceding native modal would otherwise block interaction.
 * @param {ModalAdapterInlineProps<TResult>} props - Modal configuration and external overlay lifecycle controls.
 * @param {boolean} [props.isHostedInTopLayer] - Internal router decision to retain this inline modal in a native host until removal.
 * @param {'inline' | 'top-layer'} [props.transport] - Router selection hint; this adapter retains inline panel presentation, optionally inside a native host.
 * @param {ModalPosition} [props.position] - Panel position; defaults to center.
 * @param {'dialog' | 'alertdialog'} [props.role] - Accessible dialog role; defaults to dialog.
 * @param {string} [props.ariaLabel] - Accessible name when no labelled-by element is supplied.
 * @param {string} [props.ariaLabelledBy] - Space-separated IDs of mounted elements naming the dialog.
 * @param {string} [props.ariaDescribedBy] - Space-separated IDs of mounted elements describing the dialog.
 * @param {boolean} [props.dismissible] - Whether top-modal Escape and backdrop interactions close the modal; defaults to true.
 * @param {() => void} [props.onDismiss] - Callback for Escape or backdrop dismissal, before closing.
 * @param {ModalCloseHandler<TResult>} [props.onModalClose] - Once-per-modal close notification, including programmatic close paths.
 * @param {string} [props.className] - Panel class names.
 * @param {React.CSSProperties} [props.style] - Panel inline styles overriding default motion and positioning styles.
 * @param {string} [props.backdropClassName] - Backdrop class names; top-layer attaches these to the dialog.
 * @param {React.CSSProperties} [props.backdropStyle] - Backdrop styles; top-layer serializes these into a scoped backdrop rule.
 * @param {boolean} [props.autoFocus] - Whether the adapter explicitly focuses the first eligible descendant; defaults to true. Native dialog focus may still move when false.
 * @param {boolean} [props.restoreFocus] - Whether to restore the previous connected focus target on unmount; defaults to true.
 * @param {ModalRender<TResult>} props.render - Pure content renderer receiving a scoped close callback and modal context.
 * @returns {React.JSX.Element} Mounted modal transport and its rendered content.
 * @example
 * ```tsx
 * <ModalProvider>
 *   <ModalAdapterInline {...overlayProps} ariaLabel="Confirm"
 *     render={close => <button onClick={() => close(true)}>Confirm</button>} />
 * </ModalProvider>
 * ```
 */
export function ModalAdapterInline<TResult>({
  id,
  isOpen,
  status,
  close,
  remove,
  render,
  position = 'center',
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  dismissible = true,
  onDismiss,
  className,
  style,
  backdropClassName,
  backdropStyle,
  autoFocus = true,
  restoreFocus = true,
  isHostedInTopLayer = false,
}: ModalAdapterInlineProps<TResult>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeDialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { containsTarget, isTopModal, stackIndex } = useModalStackInfo(id, wrapperRef);

  useEffect(() => {
    const dialog = nativeDialogRef.current;
    if (!dialog) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    dialog.addEventListener('close', remove);
    // Match the native adapter's effect phase so batched siblings keep their top-layer order.
    dialog.showModal();

    return () => {
      dialog.removeEventListener('close', remove);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [isHostedInTopLayer, remove]);

  // Body scroll lock
  useEffect(() => {
    if (scrollLockCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount++;
    
    return () => {
      scrollLockCount--;
      if (scrollLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
      }
    };
  }, []);

  const { prefersReducedMotion, handleAnimationEnd } = useModalExit(containerRef, status, remove);

  useEffect(() => {
    if (!isHostedInTopLayer) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }

    if (autoFocus && containerRef.current) {
      const focusable = getFocusableElements(containerRef.current)[0] ?? containerRef.current;
      focusable.focus();
    }

    return () => {
      if (restoreFocus && previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [autoFocus, restoreFocus, isHostedInTopLayer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTopModal && dismissible && status !== 'closing') {
          const targetIsForeignTopLayer = e.target instanceof Element &&
            e.target.closest('.ilokesto-modal-dialog') !== null &&
            !containsTarget(e.target);

          if (!targetIsForeignTopLayer) {
            e.preventDefault();
          }
          e.stopPropagation();
          onDismiss?.();
          close();
        }
      } else if (isTopModal && e.key === 'Tab' && containerRef.current) {
        const focusables = getFocusableElements(containerRef.current);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close, containsTarget, dismissible, isTopModal, onDismiss, status]);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if (!isTopModal || !containerRef.current || status === 'closing') return;
      const target = e.target instanceof Node ? e.target : null;

      if (target && containerRef.current.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest('.ilokesto-modal-inline-wrapper, .ilokesto-modal-dialog') &&
        !containsTarget(target)
      ) return;

      const focusable = getFocusableElements(containerRef.current)[0] ?? containerRef.current;
      focusable.focus();
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [containsTarget, isTopModal, status]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (isTopModal && dismissible && e.target === e.currentTarget && status !== 'closing') {
        onDismiss?.();
        close();
      }
    },
    [close, dismissible, isTopModal, onDismiss, status]
  );

  const isClosing = status === 'closing';
  const content = render(close, { id, status, isOpen, close });

  const animationDuration = prefersReducedMotion ? '0s' : '0.2s';
  const backdropAnimation = isClosing
    ? `ilokestoModalFadeOut ${animationDuration} ease-out forwards`
    : `ilokestoModalFadeIn ${animationDuration} ease-out forwards`;
  const panelAnimation = isClosing
    ? `ilokestoModalScaleOut ${animationDuration} ease-out forwards`
    : `ilokestoModalScaleIn ${animationDuration} ease-out forwards`;

  const panel = (
    <div
      ref={wrapperRef}
      className={`ilokesto-modal-inline-wrapper ${isClosing ? 'ilokesto-modal-closing' : 'ilokesto-modal-open'}`}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        zIndex: 10000 + stackIndex,
        ...getPositionStyles(position),
      }}
    >
      <button
        type="button"
        aria-label="Dismiss modal"
        tabIndex={-1}
        className={`ilokesto-modal-backdrop ${backdropClassName || ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          border: 0,
          padding: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          animation: backdropAnimation,
          ...backdropStyle,
        }}
        onClick={handleBackdropClick}
      />
      <div
        ref={containerRef}
        role={isHostedInTopLayer ? undefined : role}
        aria-modal={isHostedInTopLayer ? undefined : true}
        aria-label={isHostedInTopLayer ? undefined : ariaLabel}
        aria-labelledby={isHostedInTopLayer ? undefined : ariaLabelledBy}
        aria-describedby={isHostedInTopLayer ? undefined : ariaDescribedBy}
        tabIndex={-1}
        className={`ilokesto-modal-panel ${className || ''}`}
        style={{
          position: 'relative',
          zIndex: 1,
          animation: panelAnimation,
          ...style,
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        {content}
      </div>
    </div>
  );

  if (!isHostedInTopLayer) {
    return panel;
  }

  return (
    <dialog
      ref={nativeDialogRef}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className="ilokesto-modal-dialog ilokesto-modal-inline-host"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        padding: 0,
        border: 0,
        background: 'transparent',
        color: 'inherit',
        overflow: 'visible',
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (event.target === event.currentTarget && isTopModal && dismissible && status !== 'closing') {
          onDismiss?.();
          close();
        }
      }}
    >
      {panel}
    </dialog>
  );
}
