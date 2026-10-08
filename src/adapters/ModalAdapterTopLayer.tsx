import React, { useEffect, useRef, useCallback, useId } from 'react';
import { useIsTopModal } from '../hooks/useIsTopModal';
import { useModalExit } from '../hooks/useModalExit';
import { getFocusableElements } from '../shared/getFocusableElements';
import type { ModalAdapterProps, ModalPosition } from '../shared/types';

function getDialogPositionStyles(pos?: ModalPosition): React.CSSProperties {
  switch (pos) {
    case 'top': return { marginBottom: 'auto', marginTop: '2rem' };
    case 'bottom': return { marginTop: 'auto', marginBottom: '2rem' };
    case 'left': return { marginRight: 'auto', marginLeft: '2rem' };
    case 'right': return { marginLeft: 'auto', marginRight: '2rem' };
    case 'top-left': return { marginBottom: 'auto', marginRight: 'auto', margin: '2rem auto auto 2rem' };
    case 'top-right': return { marginBottom: 'auto', marginLeft: 'auto', margin: '2rem 2rem auto auto' };
    case 'bottom-left': return { marginTop: 'auto', marginRight: 'auto', margin: 'auto auto 2rem 2rem' };
    case 'bottom-right': return { marginTop: 'auto', marginLeft: 'auto', margin: 'auto 2rem 2rem auto' };
    case 'center':
    default: return { margin: 'auto' };
  }
}

function cssPropertiesToString(style: React.CSSProperties): string {
  return Object.entries(style).map(([k, v]) => {
    const kebabName = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    return `${kebabName}: ${v};`;
  }).join(' ');
}

export function ModalAdapterTopLayer<TResult>({
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
}: ModalAdapterProps<TResult>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const uniqueId = useId().replace(/:/g, '');
  const isTopModal = useIsTopModal(id, dialogRef);
  const finishExit = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) {
      dialog.close();
    }
    remove();
  }, [remove]);
  const { prefersReducedMotion, handleAnimationEnd } = useModalExit(dialogRef, status, finishExit);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    if (!dialog.open) {
      dialog.showModal();
    }

    if (autoFocus) {
      const focusable = getFocusableElements(dialog)[0] ?? dialog;
      focusable.focus();
    }

    return () => {
      if (restoreFocus && previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [autoFocus, restoreFocus]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      if (isTopModal && dismissible && status !== 'closing') {
        e.preventDefault();
        onDismiss?.();
        close();
      } else {
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (isTopModal && dismissible && e.target === dialog && status !== 'closing') {
        const { left, right, top, bottom } = dialog.getBoundingClientRect();
        const isBackdropClick = e.clientX < left || e.clientX > right ||
          e.clientY < top || e.clientY > bottom;

        if (isBackdropClick) {
          onDismiss?.();
          close();
        }
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [close, dismissible, isTopModal, onDismiss, status]);

  const isClosing = status === 'closing';
  const animationDuration = prefersReducedMotion ? '0s' : '0.2s';
  const content = render(close, { id, status, isOpen, close });
  const panelAnimation = isClosing
    ? `ilokestoModalScaleOut ${animationDuration} ease-out forwards`
    : `ilokestoModalScaleIn ${animationDuration} ease-out forwards`;

  const classes = [
    'ilokesto-modal-dialog',
    `ilokesto-modal-dialog-${uniqueId}`,
    isClosing ? 'ilokesto-modal-closing' : 'ilokesto-modal-open',
    className || ''
  ].filter(Boolean).join(' ');

  const dynamicBackdropClass = backdropClassName ? ` ${backdropClassName}` : '';

  return (
    <>
      {(backdropStyle || backdropClassName) && (
        <style>
          {`
            .ilokesto-modal-dialog-${uniqueId}::backdrop {
              ${backdropStyle ? cssPropertiesToString(backdropStyle) : ''}
            }
          `}
        </style>
      )}
      <dialog
        ref={dialogRef}
        role={role === 'alertdialog' ? 'alertdialog' : undefined}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={classes + dynamicBackdropClass}
        style={{
          animation: panelAnimation,
          ...getDialogPositionStyles(position),
          ...style,
        }}
        onAnimationEnd={handleAnimationEnd}
      >
        {content}
      </dialog>
    </>
  );
}
