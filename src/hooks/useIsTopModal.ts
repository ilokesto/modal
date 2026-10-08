import { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { ModalStackRuntimeContext } from '../shared/ModalStackRuntimeContext';

function getServerSnapshot() {
  return 0;
}

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

export function useIsTopModal(id: string, elementRef: RefObject<HTMLElement | null>) {
  return useModalStackInfo(id, elementRef).isTopModal;
}
