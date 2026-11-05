/// <reference types="@testing-library/jest-dom" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalProvider } from '../../src/components/ModalProvider';
import { globalModalStore, modal } from '../../src/facade/modalFacade';

describe('top-layer native close synchronization', () => {
  afterEach(() => {
    act(() => modal.clear());
    cleanup();
  });

  it.each(['open', 'close', 'reject', 'closeAll'] as const)(
    'native close: %s modal -> removes the item and preserves its settlement',
    async (state) => {
      const onModalClose = vi.fn();
      const onDismiss = vi.fn();
      const settled = vi.fn();
      const reason = new Error('Rejected modal');
      render(<ModalProvider><button>Opener</button></ModalProvider>);
      act(() => {
        void modal.display<number>({
          id: 'native-close',
          transport: 'top-layer',
          ariaLabel: 'Native close',
          onModalClose,
          onDismiss,
          render: () => null,
        }).then(
          (value) => settled('resolved', value),
          (error) => settled('rejected', error),
        );
      });
      const dialog = screen.getByRole('dialog', { name: 'Native close' }) as HTMLDialogElement;
      act(() => {
        if (state === 'close') {
          modal.close('native-close', 42);
        }
        if (state === 'reject') {
          modal.reject('native-close', reason);
        }
        if (state === 'closeAll') {
          modal.closeAll();
        }
      });

      act(() => {
        dialog.close();
        fireEvent(dialog, new Event('close'));
      });

      expect(globalModalStore.getSnapshot()).toHaveLength(0);
      await vi.waitFor(() => expect(settled).toHaveBeenCalledTimes(1));
      expect(settled).toHaveBeenCalledWith(
        state === 'reject' ? 'rejected' : 'resolved',
        state === 'reject' ? reason : state === 'close' ? 42 : undefined,
      );
      expect(onModalClose).toHaveBeenCalledTimes(1);
      expect(onModalClose).toHaveBeenCalledWith(state === 'close' ? 42 : undefined);
      expect(onDismiss).not.toHaveBeenCalled();
    },
  );

  it('native close: a descendant dialog closes -> the managed modal remains open', () => {
    render(<ModalProvider>App</ModalProvider>);
    act(() => {
      void modal.display({
        id: 'parent',
        transport: 'top-layer',
        ariaLabel: 'Managed dialog',
        render: () => <dialog open aria-label="Embedded dialog">Embedded content</dialog>,
      });
    });

    fireEvent(screen.getByRole('dialog', { name: 'Embedded dialog' }), new Event('close'));

    expect(globalModalStore.getSnapshot()).toMatchObject([{ id: 'parent', status: 'open' }]);
  });
});
