import type { JSX } from 'react';
import type { OverlayRenderProps } from '@ilokesto/overlay';
import type { ModalAdapterProps } from '../shared/types';
import { ModalAdapterInline } from './ModalAdapterInline';
import { ModalAdapterTopLayer } from './ModalAdapterTopLayer';

type ModalAdapterInput<TResult = unknown> = OverlayRenderProps<TResult> & Record<string, unknown>;
type ResolvedModalAdapterProps<TResult = unknown> = ModalAdapterInput<TResult> & ModalAdapterProps<TResult>;

function hasModalRender<TResult>(props: ModalAdapterInput<TResult>): props is ResolvedModalAdapterProps<TResult> {
  return typeof props.render === 'function';
}

/**
 * @description Selects the inline or native top-layer adapter from overlay data. Returns null when the overlay props do not contain a render function.
 * @param {ModalAdapterInput<TResult>} props - Overlay render state and untyped adapter data supplied by OverlayProvider.
 * @returns {JSX.Element | null} Selected adapter element, or null for non-modal data.
 * @example
 * ```tsx
 * <ModalProvider>
 *   <ModalAdapter {...overlayProps} transport="top-layer" ariaLabel="Confirm"
 *     render={close => <button onClick={() => close(true)}>Confirm</button>} />
 * </ModalProvider>
 * ```
 */
export function ModalAdapter<TResult>(props: ModalAdapterInput<TResult>): JSX.Element | null {
  if (!hasModalRender(props)) {
    return null;
  }

  const { transport = 'inline' } = props;

  if (transport === 'top-layer') {
    return <ModalAdapterTopLayer {...props} />;
  }

  return <ModalAdapterInline {...props} />;
}
