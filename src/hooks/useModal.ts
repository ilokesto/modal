import { useOverlay } from '@ilokesto/overlay';
import type { ModalProps } from '../shared/types';

export type UseModalOptions<TResult = unknown> = ModalProps<TResult> & {
  /** Optional stable overlay ID; pending duplicate IDs reuse the existing request. */
  id?: string;
};

/**
 * @description Returns modal controls bound to the nearest ModalProvider. Display results settle after removal, allowing the exit animation to finish first.
 * @returns {object} Scoped modal controls.
 * - display `<TResult>(options: UseModalOptions<TResult>) => Promise<TResult | undefined>` - Displays a modal and awaits its result after exit; rejection is delivered after removal.
 * - close `(id: string, result?: unknown) => void` - Starts closing a scoped modal; its result settles on removal.
 * - closeAll `() => void` - Starts closing every overlay in the provider store.
 * - reject `(id: string, reason?: unknown) => void` - Starts closing with a rejection delivered on removal.
 * - remove `(id?: string) => void` - Immediately removes the specified overlay, or the last overlay when omitted.
 * - clear `() => void` - Immediately removes all overlays and settles their pending requests.
 * @example
 * ```tsx
 * function ConfirmButton() {
 *   const { display } = useModal();
 *   return <button onClick={() => void display<boolean>({
 *     ariaLabel: "Confirm", render: close => <button onClick={() => close(true)}>Confirm</button>,
 *   })}>Open</button>;
 * }
 * ```
 */
export function useModal() {
  const { display, close, closeAll, reject, remove, clear } = useOverlay();

  return {
    display: <TResult = unknown>(options: UseModalOptions<TResult>) => {
      return display<TResult>({
        id: options.id,
        type: 'modal',
        props: options as unknown as Record<string, unknown>,
      });
    },
    close,
    closeAll,
    reject,
    remove,
    clear,
  };
}
