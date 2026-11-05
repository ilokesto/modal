import type { DisplayOptions, OverlayItem, OverlayStoreApi } from '@ilokesto/overlay';
import type { ModalCloseHandler } from './types';

function getModalCloseHandler(item: OverlayItem): ModalCloseHandler<unknown> | undefined {
  const onModalClose = item.props.onModalClose;

  return typeof onModalClose === 'function'
    ? onModalClose as ModalCloseHandler<unknown>
    : undefined;
}

/**
 * @description Wraps an overlay store with once-per-modal close notifications after accepted transitions. Close and reject notify after recording their result; remove and clear notify after removal. CloseAll defers notification until removal, and ignored closing requests do not notify.
 * @param {OverlayStoreApi} store - Underlying overlay store whose operations and snapshots are delegated.
 * @returns {OverlayStoreApi} A lifecycle-aware store with the external overlay API unchanged.
 * @example
 * ```ts
 * const store = createModalLifecycleStore(createOverlayStore());
 * const request = store.open({ type: "modal", props: { onModalClose: result => save(result) } });
 * store.close(request.id, true);
 * store.remove(request.id);
 * ```
 */
export function createModalLifecycleStore(store: OverlayStoreApi): OverlayStoreApi {
  const notifiedModalIds = new Set<string>();

  function takeModalCloseNotification(item: OverlayItem | undefined, result?: unknown) {
    if (!item || item.type !== 'modal' || notifiedModalIds.has(item.id)) {
      return;
    }

    // Reserve before delegating: synchronous subscribers can remove or reopen this id.
    notifiedModalIds.add(item.id);
    const onModalClose = getModalCloseHandler(item);
    return () => onModalClose?.(result);
  }

  function commitAndNotify(operation: () => void, notifications: Array<(() => void) | undefined>) {
    let delegateFailed = false;
    let delegateError: unknown;
    try {
      operation();
    } catch (error) {
      // Registry overlay operations commit before notifying synchronous subscribers.
      delegateFailed = true;
      delegateError = error;
    }

    const callbackErrors: unknown[] = [];
    for (const notify of notifications) {
      try {
        notify?.();
      } catch (error) {
        callbackErrors.push(error);
      }
    }
    if (delegateFailed) {
      throw delegateError;
    }
    if (callbackErrors.length === 1) {
      throw callbackErrors[0];
    }
    if (callbackErrors.length > 1) {
      throw new AggregateError(callbackErrors, 'Modal close notification failed');
    }
  }

  return {
    open: <TResult = unknown>(options: DisplayOptions) => {
      // A duplicate open for an already-pending id must not reset its close
      // notification, otherwise a later close/remove can fire twice.
      const existingId = typeof options.id === 'string'
        ? store.getSnapshot().some((item) => item.id === options.id)
        : false;
      if (!existingId && typeof options.id === 'string') {
        notifiedModalIds.delete(options.id);
      }

      return store.open<TResult>(options);
    },
    close: (id, result) => {
      const item = store.getSnapshot().find((candidate) => candidate.id === id);

      const notify = item?.status === 'open' ? takeModalCloseNotification(item, result) : undefined;
      commitAndNotify(() => store.close(id, result), [notify]);
    },
    closeAll: () => {
      store.closeAll();
    },
    reject: (id, reason) => {
      const item = store.getSnapshot().find((candidate) => candidate.id === id);

      const notify = item?.status === 'open' ? takeModalCloseNotification(item, undefined) : undefined;
      commitAndNotify(() => store.reject(id, reason), [notify]);
    },
    remove: (id) => {
      const items = store.getSnapshot();
      const targetId = id ?? items[items.length - 1]?.id;
      const item = items.find((candidate) => candidate.id === targetId);
      const notify = takeModalCloseNotification(item, item?.closeResult);

      if (targetId !== undefined) {
        notifiedModalIds.delete(targetId);
      }
      commitAndNotify(() => store.remove(targetId), [notify]);
    },
    clear: () => {
      const items = store.getSnapshot();

      const notifications = items.map((item) => takeModalCloseNotification(item, item.closeResult));
      for (const item of items) {
        notifiedModalIds.delete(item.id);
      }
      commitAndNotify(() => store.clear(), notifications);
    },
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    getInitialSnapshot: store.getInitialSnapshot,
  };
}
