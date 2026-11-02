import { createOverlayStore } from '@ilokesto/overlay';
import { createModalLifecycleStore } from '../shared/lifecycle';
import type { ModalProps } from '../shared/types';

/** Shared lifecycle-aware store used by the facade and providers without a dedicated store. */
export const globalModalStore = createModalLifecycleStore(createOverlayStore());

export type ModalFacadeOptions<TResult = unknown> = ModalProps<TResult> & {
  /** Optional stable overlay ID; pending duplicate IDs reuse the existing request. */
  id?: string;
};

/** Global modal controls; mount a default ModalProvider to render their requests. */
export const modal = {
  /**
   * @description Opens a modal in the shared global store and returns its ID immediately. Mount a default ModalProvider to render it.
   * @param {ModalFacadeOptions<TResult>} options - Modal content and presentation settings.
   * @param {'inline' | 'top-layer'} [options.transport] - Rendering transport; inline is the default.
   * @param {ModalPosition} [options.position] - Panel position; defaults to center.
   * @param {'dialog' | 'alertdialog'} [options.role] - Accessible dialog role; defaults to dialog.
   * @param {string} [options.ariaLabel] - Accessible name when no labelled-by element is supplied.
   * @param {string} [options.ariaLabelledBy] - Space-separated IDs of mounted elements naming the dialog.
   * @param {string} [options.ariaDescribedBy] - Space-separated IDs of mounted elements describing the dialog.
   * @param {boolean} [options.dismissible] - Whether top-modal Escape and backdrop interactions close the modal; defaults to true.
   * @param {() => void} [options.onDismiss] - Callback for Escape or backdrop dismissal, before closing.
   * @param {ModalCloseHandler<TResult>} [options.onModalClose] - Once-per-modal close notification, including programmatic close paths.
   * @param {string} [options.className] - Panel class names.
   * @param {React.CSSProperties} [options.style] - Panel inline styles overriding default motion and positioning styles.
   * @param {string} [options.backdropClassName] - Backdrop class names; top-layer attaches these to the dialog.
   * @param {React.CSSProperties} [options.backdropStyle] - Backdrop styles; top-layer serializes these into a scoped backdrop rule.
   * @param {boolean} [options.autoFocus] - Whether the adapter explicitly focuses the first eligible descendant; defaults to true. Native dialog focus may still move when false.
   * @param {boolean} [options.restoreFocus] - Whether to restore the previous connected focus target on unmount; defaults to true.
   * @param {ModalRender<TResult>} options.render - Pure content renderer with a modal-scoped close callback.
   * @param {string} [options.id] - Stable ID; pending duplicate IDs reuse the existing modal.
   * @returns {string} Identifier used by close, reject or remove.
   * @example
   * ```tsx
   * const id = modal.open<boolean>({ ariaLabel: "Confirm", render: close => <button onClick={() => close(true)}>Confirm</button> });
   * ```
   */
  open: <TResult = unknown>(options: ModalFacadeOptions<TResult>) => {
    return globalModalStore.open<TResult>({
      id: options.id,
      type: 'modal',
      props: options as unknown as Record<string, unknown>,
    }).id;
  },
  /**
   * @description Opens a modal in the shared global store and awaits its result after exit removal. Rejected modals reject the promise on removal.
   * @param {ModalFacadeOptions<TResult>} options - Modal content and presentation settings.
   * @param {'inline' | 'top-layer'} [options.transport] - Rendering transport; inline is the default.
   * @param {ModalPosition} [options.position] - Panel position; defaults to center.
   * @param {'dialog' | 'alertdialog'} [options.role] - Accessible dialog role; defaults to dialog.
   * @param {string} [options.ariaLabel] - Accessible name when no labelled-by element is supplied.
   * @param {string} [options.ariaLabelledBy] - Space-separated IDs of mounted elements naming the dialog.
   * @param {string} [options.ariaDescribedBy] - Space-separated IDs of mounted elements describing the dialog.
   * @param {boolean} [options.dismissible] - Whether top-modal Escape and backdrop interactions close the modal; defaults to true.
   * @param {() => void} [options.onDismiss] - Callback for Escape or backdrop dismissal, before closing.
   * @param {ModalCloseHandler<TResult>} [options.onModalClose] - Once-per-modal close notification, including programmatic close paths.
   * @param {string} [options.className] - Panel class names.
   * @param {React.CSSProperties} [options.style] - Panel inline styles overriding default motion and positioning styles.
   * @param {string} [options.backdropClassName] - Backdrop class names; top-layer attaches these to the dialog.
   * @param {React.CSSProperties} [options.backdropStyle] - Backdrop styles; top-layer serializes these into a scoped backdrop rule.
   * @param {boolean} [options.autoFocus] - Whether the adapter explicitly focuses the first eligible descendant; defaults to true. Native dialog focus may still move when false.
   * @param {boolean} [options.restoreFocus] - Whether to restore the previous connected focus target on unmount; defaults to true.
   * @param {ModalRender<TResult>} options.render - Pure content renderer with a modal-scoped close callback.
   * @param {string} [options.id] - Stable ID; pending duplicate IDs reuse the existing modal.
   * @returns {Promise<TResult | undefined>} Result after removal, or undefined when closed without a result.
   * @example
   * ```tsx
   * const confirmed = await modal.display<boolean>({ ariaLabel: "Confirm", render: close => <button onClick={() => close(true)}>Confirm</button> });
   * ```
   */
  display: <TResult = unknown>(options: ModalFacadeOptions<TResult>) => {
    return globalModalStore.open<TResult>({
      id: options.id,
      type: 'modal',
      props: options as unknown as Record<string, unknown>,
    }).promise;
  },
  /**
   * @description Marks a global modal as closing and notifies its close handler once; removal after exit settles the result.
   * @param {string} id - Modal identifier.
   * @param {unknown} [result] - Result delivered when the modal is removed.
   * @example
   * modal.close("confirm", true);
   */
  close: (id: string, result?: unknown) => globalModalStore.close(id, result),
  /**
   * @description Marks all global modals as closing. Close handlers are notified later on removal with undefined unless already notified.
   * @example
   * modal.closeAll();
   */
  closeAll: () => globalModalStore.closeAll(),
  /**
   * @description Marks a global modal as closing with a rejection reason and notifies its close handler with undefined; removal rejects its promise.
   * @param {string} id - Modal identifier.
   * @param {unknown} [reason] - Rejection reason delivered after removal.
   * @example
   * modal.reject("confirm", new Error("Cancelled"));
   */
  reject: (id: string, reason?: unknown) => globalModalStore.reject(id, reason),
  /**
   * @description Removes a global modal immediately, settling its pending promise and notifying any remaining close handler. Skips exit animation.
   * @param {string} [id] - Modal to remove; omitted selects the last global overlay.
   * @example
   * modal.remove("confirm");
   */
  remove: (id?: string) => globalModalStore.remove(id),
  /**
   * @description Removes all global modals immediately, settling pending promises and notifying any remaining close handlers without exit animation.
   * @example
   * modal.clear();
   */
  clear: () => globalModalStore.clear(),
};
