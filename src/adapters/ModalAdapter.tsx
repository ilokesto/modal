import { useLayoutEffect, useState } from 'react';
import type { JSX } from 'react';
import type { OverlayRenderProps } from '@ilokesto/overlay';
import type { ModalAdapterProps } from '../shared/types';
import { ModalAdapterInline } from './ModalAdapterInline';
import { ModalAdapterTopLayer } from './ModalAdapterTopLayer';

type ModalAdapterInput<TResult = unknown> = OverlayRenderProps<TResult> & Record<string, unknown>;
type ResolvedModalAdapterProps<TResult = unknown> = ModalAdapterInput<TResult> & ModalAdapterProps<TResult>;

const nativeModalTokens = new Set<symbol>();

function hasModalRender<TResult>(props: ModalAdapterInput<TResult>): props is ResolvedModalAdapterProps<TResult> {
  return typeof props.render === 'function';
}

function ModalAdapterTransport<TResult>(props: ResolvedModalAdapterProps<TResult>): JSX.Element | null {
  const { id, transport = 'inline' } = props;
  const [requiresNativeLayer, setRequiresNativeLayer] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    // Reserve native hosting before sibling adapters mount, including batched opens.
    const native = transport === 'top-layer' || nativeModalTokens.size > 0 ||
      document.querySelector('dialog.ilokesto-modal-dialog[open]') !== null;
    setRequiresNativeLayer(native);

    if (native) {
      const token = Symbol(id);
      nativeModalTokens.add(token);
      return () => {
        nativeModalTokens.delete(token);
      };
    }
  }, [id, transport]);

  if (requiresNativeLayer === null) {
    return null;
  }

  if (transport === 'top-layer') {
    return <ModalAdapterTopLayer {...props} />;
  }

  return <ModalAdapterInline {...props} isHostedInTopLayer={requiresNativeLayer} />;
}

/**
 * @description Selects the inline or native top-layer adapter from overlay data, deferring content mounting until its host is selected. Inline modals opened above a native modal retain their presentation inside a native host until removal. Returns null when overlay props lack a render function.
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

  return <ModalAdapterTransport {...props} />;
}
