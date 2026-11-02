import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { ModalStackRuntimeContext } from '../shared/ModalStackRuntimeContext';

function getServerSnapshot() {
  return 0;
}

/**
 * @description Registers an adapter in the nearest provider and subscribes to its stack position. Throws outside ModalProvider.
 * @param {string} id - Modal identifier used to label its stable registration token.
 * @param {RefObject<HTMLElement | null>} elementRef - Adapter boundary used for provider-local containment checks.
 * @returns {ModalStackInfo} Current registration state.
 * - isTopModal `boolean` - Whether this registration is last in the provider stack.
 * - stackIndex `number` - Zero-based stack position, or zero before registration.
 * - containsTarget `(target: Node) => boolean` - Whether any registered modal in this provider contains the node.
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * const { isTopModal, stackIndex } = useModalStackInfo(id, ref);
 * ```
 */
export function useModalStackInfo(id: string, elementRef: RefObject<HTMLElement | null>) {
  const runtime = useContext(ModalStackRuntimeContext);
  const tokenRef = useRef<symbol | null>(null);

  if (runtime === null) {
    throw new Error('Modal adapters must be rendered within a ModalProvider.');
  }

  if (!tokenRef.current) {
    tokenRef.current = Symbol(id);
  }

  useEffect(() => {
    if (!tokenRef.current) return;

    return runtime.register({ id, token: tokenRef.current, elementRef });
  }, [elementRef, id, runtime]);

  useSyncExternalStore(runtime.subscribe, runtime.getVersion, getServerSnapshot);

  return runtime.getStackInfo(tokenRef.current);
}

/**
 * @description Registers a modal boundary and reports whether it is the nearest provider's top modal. Throws outside ModalProvider.
 * @param {string} id - Modal identifier used for registration.
 * @param {RefObject<HTMLElement | null>} elementRef - Adapter boundary for containment checks.
 * @returns {boolean} Whether the modal is the provider's top registration.
 * @example
 * ```tsx
 * const ref = useRef<HTMLDialogElement>(null);
 * const isTop = useIsTopModal(id, ref);
 * ```
 */
export function useIsTopModal(id: string, elementRef: RefObject<HTMLElement | null>) {
  return useModalStackInfo(id, elementRef).isTopModal;
}
