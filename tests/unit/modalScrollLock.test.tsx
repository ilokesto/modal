/// <reference types="@testing-library/jest-dom" />

import { StrictMode } from 'react';
import { createOverlayStore } from '@ilokesto/overlay';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalProvider } from '../../src/components/ModalProvider';

afterEach(() => {
  cleanup();
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('overflow-x');
  document.body.style.removeProperty('overflow-y');
});

describe('shared modal scroll lock', () => {
  it.each(['', 'auto', 'clip'])(
    'top-layer: original overflow %s -> stays locked while closing and restores after removal',
    (overflow) => {
      document.body.style.overflow = overflow;
      const store = createOverlayStore();
      store.open({
        id: 'native',
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: 'Native', render: () => null },
      });

      render(<ModalProvider store={store}>App</ModalProvider>);

      expect(document.body.style.overflow).toBe('hidden');
      act(() => store.close('native'));
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.animationEnd(screen.getByRole('dialog', { name: 'Native' }));
      expect(document.body.style.overflow).toBe(overflow);
    },
  );

  for (const firstTransport of ['inline', 'top-layer'] as const) {
    for (const secondTransport of ['inline', 'top-layer'] as const) {
      it.each(['first', 'second'] as const)(
        `ownership: ${firstTransport}/${secondTransport}, %s closes first -> only the last provider releases the lock`,
        (firstToClose) => {
          document.body.style.setProperty('overflow', 'auto', 'important');
          const first = createOverlayStore();
          const second = createOverlayStore();
          const stores = { first, second };
          first.open({
            id: 'first',
            type: 'modal',
            props: { transport: firstTransport, ariaLabel: 'first', render: () => null },
          });
          second.open({
            id: 'second',
            type: 'modal',
            props: { transport: secondTransport, ariaLabel: 'second', render: () => null },
          });
          render(
            <StrictMode>
              <ModalProvider store={first}>First provider</ModalProvider>
              <ModalProvider store={second}>Second provider</ModalProvider>
            </StrictMode>,
          );
          const closeOrder = firstToClose === 'first' ? ['first', 'second'] as const : ['second', 'first'] as const;

          for (const [index, id] of closeOrder.entries()) {
            act(() => stores[id].close(id));
            expect(document.body.style.overflow).toBe('hidden');
            const dialog = screen.getByRole('dialog', { name: id });
            fireEvent.animationEnd(dialog.querySelector('.ilokesto-modal-panel') ?? dialog);

            expect(document.body.style.overflow).toBe(index === 0 ? 'hidden' : 'auto');
          }
          expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
        },
      );
    }
  }

  it('ownership: provider unmounts before its native sibling -> retains the lock until final unmount', () => {
    document.body.style.overflow = 'scroll';
    const first = createOverlayStore();
    const second = createOverlayStore();
    for (const [id, store] of [['first', first], ['second', second]] as const) {
      store.open({
        id,
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: id, render: () => null },
      });
    }
    const providers = (showFirst: boolean) => (
      <>
        {showFirst && <ModalProvider store={first}>First provider</ModalProvider>}
        <ModalProvider store={second}>Second provider</ModalProvider>
      </>
    );
    const { rerender, unmount } = render(providers(true));

    rerender(providers(false));

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('restoration: independent overflow axes and priorities -> restores each original declaration', () => {
    document.body.style.setProperty('overflow-x', 'scroll', 'important');
    document.body.style.setProperty('overflow-y', 'auto');
    const store = createOverlayStore();
    store.open({
      id: 'native',
      type: 'modal',
      props: { transport: 'top-layer', ariaLabel: 'Native', render: () => null },
    });
    const { unmount } = render(<ModalProvider store={store}>App</ModalProvider>);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.getPropertyValue('overflow-x')).toBe('scroll');
    expect(document.body.style.getPropertyPriority('overflow-x')).toBe('important');
    expect(document.body.style.getPropertyValue('overflow-y')).toBe('auto');
    expect(document.body.style.getPropertyPriority('overflow-y')).toBe('');
  });
});
