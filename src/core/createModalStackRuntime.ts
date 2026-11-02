interface ModalStackEntry {
  /** Human-readable modal ID; identity and removal use the unique token. */
  readonly id: string;
  /** Unique registration identity even when modal IDs are reused. */
  readonly token: symbol;
  /** Mounted adapter boundary used to determine provider-local containment. */
  readonly elementRef: { readonly current: HTMLElement | null };
}

/** Provider-local status and containment policy for one registration. */
export interface ModalStackInfo {
  /** Whether this registration is the last entry in its provider. */
  readonly isTopModal: boolean;
  /** Zero-based stack position, or zero for an unregistered token. */
  readonly stackIndex: number;
  /** Tests containment across every mounted entry in the same provider. */
  readonly containsTarget: (target: Node) => boolean;
}

/** Registration and subscription controls owned by one ModalProvider. */
export interface ModalStackRuntime {
  /** Appends an entry, emits a change and returns token-specific cleanup. */
  readonly register: (entry: ModalStackEntry) => () => void;
  /** Observes registration changes and returns unsubscribe cleanup. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Reads the current monotonic change version for useSyncExternalStore. */
  readonly getVersion: () => number;
  /** Reads top status and containment; unknown tokens report false and index zero. */
  readonly getStackInfo: (token: symbol) => ModalStackInfo;
}

/**
 * @description Creates provider-local registration and subscription state so focus and dismissal act only on that provider's top modal.
 * @returns {ModalStackRuntime} Stack bookkeeping controls.
 * - register `(entry: ModalStackEntry) => () => void` - Appends an entry and returns its unregister callback.
 * - subscribe `(listener: () => void) => () => void` - Subscribes to registration changes and returns cleanup.
 * - getVersion `() => number` - Reads the monotonically increasing change version.
 * - getStackInfo `(token: symbol) => ModalStackInfo` - Reads top status, stack index and containment for a registration token.
 * @example
 * ```ts
 * const runtime = createModalStackRuntime();
 * const token = Symbol("confirm");
 * const unregister = runtime.register({ id: "confirm", token, elementRef: { current: null } });
 * const isTop = runtime.getStackInfo(token).isTopModal;
 * unregister();
 * ```
 */
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
