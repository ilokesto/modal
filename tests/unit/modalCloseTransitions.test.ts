import { createOverlayStore } from '@ilokesto/overlay';
import { describe, expect, it, vi } from 'vitest';
import { createModalLifecycleStore } from '../../src/shared/lifecycle';

describe('modal close transition consistency', () => {
  it.each(['close', 'reject'] as const)(
    'underlying store: accepted %s followed by a wrapped close -> retains the original settlement',
    async (operation) => {
      const raw = createOverlayStore();
      const store = createModalLifecycleStore(raw);
      const callback = vi.fn();
      const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });
      const settled = request.promise.then((value) => ['resolved', value], (reason) => ['rejected', reason]);
      if (operation === 'close') {
        raw.close('modal', 'accepted');
      } else {
        raw.reject('modal', 'accepted');
      }

      store.close('modal', 'ignored');

      expect(callback).not.toHaveBeenCalled();
      store.remove('modal');
      await expect(settled).resolves.toEqual([operation === 'close' ? 'resolved' : 'rejected', 'accepted']);
      expect(callback).toHaveBeenCalledExactlyOnceWith(operation === 'close' ? 'accepted' : undefined);
    },
  );

  it.each(['close', 'reject'] as const)(
    'closeAll: late %s -> notifies only on removal with the settled result',
    async (operation) => {
      const store = createModalLifecycleStore(createOverlayStore());
      const callback = vi.fn();
      const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });
      store.closeAll();

      if (operation === 'close') {
        store.close('modal', 'ignored');
      } else {
        store.reject('modal', 'ignored');
      }

      expect(callback).not.toHaveBeenCalled();
      store.remove('modal');
      await expect(request.promise).resolves.toBeUndefined();
      expect(callback).toHaveBeenCalledExactlyOnceWith(undefined);
    },
  );

  it('close: callback removes the modal -> notification agrees with the promise', async () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const callback = vi.fn(() => store.remove('modal'));
    const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });

    store.close('modal', 'accepted');

    await expect(request.promise).resolves.toBe('accepted');
    expect(callback).toHaveBeenCalledExactlyOnceWith('accepted');
    expect(store.getSnapshot()).toHaveLength(0);
  });

  it('reject: callback removes the modal -> preserves the accepted rejection', async () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const callback = vi.fn(() => store.remove('modal'));
    const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });
    const settled = request.promise.catch((reason) => reason);

    store.reject('modal', 'accepted rejection');

    await expect(settled).resolves.toBe('accepted rejection');
    expect(callback).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('clear: a callback clears again -> notifies each captured item once', () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const first = vi.fn(() => store.clear());
    const second = vi.fn();
    store.open({ id: 'first', type: 'modal', props: { onModalClose: first } });
    store.open({ id: 'second', type: 'modal', props: { onModalClose: second } });

    store.clear();

    expect(first).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(second).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('remove: callback opens another modal -> removes only the captured target', async () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const callback = vi.fn(() => store.open({ id: 'next', type: 'modal', props: {} }));
    const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });

    store.remove();

    expect(store.getSnapshot().map((item) => item.id)).toEqual(['next']);
    await expect(request.promise).resolves.toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
    store.clear();
  });

  it('clear: callback opens another modal -> preserves the new request', async () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const callback = vi.fn(() => store.open({ id: 'next', type: 'modal', props: {} }));
    const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });

    store.clear();

    expect(store.getSnapshot().map((item) => item.id)).toEqual(['next']);
    await expect(request.promise).resolves.toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
    store.clear();
  });

  it('remove: callback reopens and closes the same id -> deduplicates each generation independently', () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const second = vi.fn();
    const first = vi.fn(() => {
      store.open({ id: 'modal', type: 'modal', props: { onModalClose: second } });
      store.close('modal', 'second');
    });
    store.open({ id: 'modal', type: 'modal', props: { onModalClose: first } });

    store.remove('modal');

    store.remove('modal');
    expect(first).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(second).toHaveBeenCalledExactlyOnceWith('second');
  });

  it('close: subscriber removes and reopens the id -> notifies each accepted result once', async () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const first = vi.fn();
    const second = vi.fn();
    const request = store.open({ id: 'modal', type: 'modal', props: { onModalClose: first } });
    const unsubscribe = store.subscribe(() => {
      if (store.getSnapshot()[0]?.status === 'closing') {
        unsubscribe();
        store.remove('modal');
        store.open({ id: 'modal', type: 'modal', props: { onModalClose: second } });
        store.close('modal', 'second');
      }
    });

    store.close('modal', 'first');

    await expect(request.promise).resolves.toBe('first');
    store.remove('modal');
    expect(first).toHaveBeenCalledExactlyOnceWith('first');
    expect(second).toHaveBeenCalledExactlyOnceWith('second');
  });

  it('open: subscriber closes immediately -> duplicate open cannot reset notification state', () => {
    const store = createModalLifecycleStore(createOverlayStore());
    const callback = vi.fn();
    const unsubscribe = store.subscribe(() => {
      if (store.getSnapshot()[0]?.status === 'open') {
        store.close('modal', 'accepted');
      }
    });

    store.open({ id: 'modal', type: 'modal', props: { onModalClose: callback } });

    unsubscribe();
    store.remove('modal');
    expect(callback).toHaveBeenCalledExactlyOnceWith('accepted');
  });
});
