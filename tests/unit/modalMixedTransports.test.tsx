/// <reference types="@testing-library/jest-dom" />

import { StrictMode } from 'react';
import { createOverlayStore } from '@ilokesto/overlay';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModalProvider } from '../../src/components/ModalProvider';

afterEach(cleanup);

describe('mixed modal transports', () => {
  it.each([undefined, 'inline'] as const)(
    'transport: native parent followed by %s child in one batch -> preserves inline presentation above a native host',
    (transport) => {
      const store = createOverlayStore();
      store.open({
        id: 'parent',
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: 'Parent', render: () => <button>Parent action</button> },
      });
      store.open({
        id: 'child',
        type: 'modal',
        props: {
          transport,
          ariaLabel: 'Child',
          className: 'custom-panel',
          backdropClassName: 'custom-backdrop',
          style: { borderWidth: 7 },
          render: () => <input aria-label="Child draft" defaultValue="saved draft" />,
        },
      });

      render(<StrictMode><ModalProvider store={store}>App</ModalProvider></StrictMode>);

      const child = screen.getByRole('dialog', { name: 'Child' });
      expect(child.tagName).toBe('DIALOG');
      expect(child).toHaveAttribute('open');
      expect(child.querySelector('.ilokesto-modal-panel.custom-panel')).toHaveStyle({ borderWidth: '7px' });
      expect(child.querySelector('.ilokesto-modal-backdrop.custom-backdrop')).not.toBeNull();
      expect(screen.getByRole('textbox', { name: 'Child draft' })).toHaveFocus();
    },
  );

  it('transport: native parent removed before hosted child -> keeps the child mounted with its input state', () => {
    const store = createOverlayStore();
    render(<ModalProvider store={store}>App</ModalProvider>);
    act(() => {
      store.open({
        id: 'parent',
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: 'Parent', render: () => null },
      });
    });
    act(() => {
      store.open({
        id: 'child',
        type: 'modal',
        props: { ariaLabel: 'Child', render: () => <input aria-label="Child draft" /> },
      });
    });
    const input = screen.getByRole('textbox', { name: 'Child draft' });
    fireEvent.change(input, { target: { value: 'keep this draft' } });

    act(() => store.remove('parent'));

    expect(screen.getByRole('textbox', { name: 'Child draft' })).toBe(input);
    expect(input).toHaveValue('keep this draft');
    expect(screen.getByRole('dialog', { name: 'Child' }).tagName).toBe('DIALOG');
  });

  it('transport: an independent provider opens a default child -> keeps its stack and dismissal isolated', () => {
    const first = createOverlayStore();
    const second = createOverlayStore();
    render(
      <>
        <ModalProvider store={first}>First provider</ModalProvider>
        <ModalProvider store={second}>Second provider</ModalProvider>
      </>,
    );
    act(() => {
      first.open({
        id: 'same-id',
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: 'Parent', render: () => null },
      });
    });
    act(() => {
      second.open({
        id: 'same-id',
        type: 'modal',
        props: { ariaLabel: 'Child', render: () => <button>Child action</button> },
      });
    });
    const child = screen.getByRole('dialog', { name: 'Child' });

    fireEvent.keyDown(screen.getByRole('button', { name: 'Child action' }), { key: 'Escape' });

    expect(child.tagName).toBe('DIALOG');
    expect(child.querySelector('.ilokesto-modal-inline-wrapper')).toHaveStyle({ zIndex: '10000' });
    expect(first.getSnapshot()[0]?.status).toBe('open');
    expect(second.getSnapshot()[0]?.status).toBe('closing');
  });

  it('transport: all native hosts unmount -> later default modals stay inline', () => {
    const store = createOverlayStore();
    const { unmount } = render(<ModalProvider store={store}>First provider</ModalProvider>);
    act(() => {
      store.open({
        id: 'native',
        type: 'modal',
        props: { transport: 'top-layer', ariaLabel: 'Native', render: () => null },
      });
    });
    unmount();
    const next = createOverlayStore();
    next.open({
      id: 'inline',
      type: 'modal',
      props: { ariaLabel: 'Inline', render: () => null },
    });

    render(<ModalProvider store={next}>Next provider</ModalProvider>);

    expect(screen.getByRole('dialog', { name: 'Inline' }).tagName).toBe('DIV');
  });

  it('native host: directly closed child -> settles once without removing its parent', async () => {
    const store = createOverlayStore();
    const onModalClose = vi.fn();
    const onDismiss = vi.fn();
    store.open({
      id: 'parent',
      type: 'modal',
      props: { transport: 'top-layer', ariaLabel: 'Parent', render: () => null },
    });
    const request = store.open({
      id: 'child',
      type: 'modal',
      props: { ariaLabel: 'Child', onModalClose, onDismiss, render: () => null },
    });
    render(<ModalProvider store={store}>App</ModalProvider>);
    const child = screen.getByRole('dialog', { name: 'Child' }) as HTMLDialogElement;

    act(() => {
      child.close();
      fireEvent(child, new Event('close'));
    });

    expect(store.getSnapshot()).toMatchObject([{ id: 'parent', status: 'open' }]);
    await expect(request.promise).resolves.toBeUndefined();
    expect(onModalClose).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
