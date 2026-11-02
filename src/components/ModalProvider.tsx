import React, { useMemo, useEffect } from 'react';
import { OverlayProvider } from '@ilokesto/overlay';
import type { OverlayStoreApi } from '@ilokesto/overlay';
import { ModalAdapter } from '../adapters/ModalAdapter';
import { globalStyles } from '../shared/styles';
import { globalModalStore } from '../facade/modalFacade';
import { createModalStackRuntime } from '../core/createModalStackRuntime';
import { ModalStackRuntimeContext } from '../shared/ModalStackRuntimeContext';
import { createModalLifecycleStore } from '../shared/lifecycle';

export interface ModalProviderProps {
  /** Application subtree with access to the provider-scoped modal controls. */
  children: React.ReactNode;
  /** Dedicated store for provider isolation; omitted providers share globalModalStore. */
  store?: OverlayStoreApi;
}

/**
 * @description Provides modal rendering, isolated stack bookkeeping and shared motion styles. Without a store it targets the global facade; use distinct stores for simultaneous providers.
 * @param {ModalProviderProps} props - Provider configuration.
 * @param {React.ReactNode} props.children - Application subtree that can use modal hooks.
 * @param {OverlayStoreApi} [props.store] - Dedicated overlay store; defaults to the shared global modal store.
 * @returns {React.JSX.Element} The overlay provider wrapped in a modal stack context.
 * @example
 * ```tsx
 * <ModalProvider><ConfirmButton /></ModalProvider>
 * ```
 */
export function ModalProvider({ children, store }: ModalProviderProps) {
  const overlayStore = useMemo(
    () => store ? createModalLifecycleStore(store) : globalModalStore,
    [store]
  );
  const modalStackRuntime = useMemo(createModalStackRuntime, []);
  const adapters = useMemo(() => ({ modal: ModalAdapter }), []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'ilokesto-modal-styles';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = globalStyles;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <ModalStackRuntimeContext.Provider value={modalStackRuntime}>
      <OverlayProvider store={overlayStore} adapters={adapters}>
        {children}
      </OverlayProvider>
    </ModalStackRuntimeContext.Provider>
  );
}
