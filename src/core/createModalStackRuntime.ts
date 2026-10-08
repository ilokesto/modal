interface ModalStackEntry {
  readonly id: string;
  readonly token: symbol;
  readonly elementRef: { readonly current: HTMLElement | null };
}

export interface ModalStackInfo {
  readonly isTopModal: boolean;
  readonly stackIndex: number;
  readonly containsTarget: (target: Node) => boolean;
}

export interface ModalStackRuntime {
  readonly register: (entry: ModalStackEntry) => () => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getVersion: () => number;
  readonly getStackInfo: (token: symbol) => ModalStackInfo;
}

export function createModalStackRuntime(): ModalStackRuntime {
  const entries: ModalStackEntry[] = [];
  const listeners = new Set<() => void>();
  let version = 0;

  const emitChange = () => {
    version++;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const containsTarget = (target: Node) => entries.some(
    (entry) => entry.elementRef.current?.contains(target) ?? false
  );

  return {
    register: (entry) => {
      entries.push(entry);
      emitChange();

      return () => {
        const index = entries.findIndex((item) => item.token === entry.token);

        if (index !== -1) {
          entries.splice(index, 1);
          emitChange();
        }
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
    getStackInfo: (token) => {
      const stackIndex = entries.findIndex((item) => item.token === token);

      return {
        isTopModal: stackIndex !== -1 && stackIndex === entries.length - 1,
        stackIndex: stackIndex === -1 ? 0 : stackIndex,
        containsTarget,
      };
    },
  };
}
