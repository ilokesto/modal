/// <reference types="@testing-library/jest-dom" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { ModalAdapterInline } from '../src/adapters/ModalAdapterInline';
import { ModalAdapterTopLayer } from '../src/adapters/ModalAdapterTopLayer';
import { renderWithModalStack } from './modalStackTestUtils';

afterEach(cleanup);

for (const Adapter of [ModalAdapterInline, ModalAdapterTopLayer]) {
  describe(Adapter.name, () => {
    it('autofocus: excluded controls precede visible controls -> first eligible control receives focus', () => {
      renderWithModalStack(
        <Adapter
          id="focus-candidates"
          isOpen
          status="open"
          close={vi.fn()}
          remove={vi.fn()}
          render={() => (
            <>
              <button hidden>Hidden</button>
              <div hidden><button>Hidden ancestor</button></div>
              <button {...{ inert: '' }}>Inert</button>
              <div {...{ inert: '' }}><button>Inert ancestor</button></div>
              <button aria-hidden="true">Aria hidden</button>
              <div aria-hidden="true"><button>Aria hidden ancestor</button></div>
              <button style={{ display: 'none' }}>Display none</button>
              <div style={{ display: 'none' }}><button>Display none ancestor</button></div>
              <button style={{ visibility: 'hidden' }}>Visibility hidden</button>
              <div style={{ visibility: 'hidden' }}><button>Visibility hidden ancestor</button></div>
              <button style={{ visibility: 'collapse' }}>Visibility collapse</button>
              <div style={{ contentVisibility: 'hidden' }}><button>Content hidden</button></div>
              <button style={{ display: 'contents' }}>No focusable box</button>
              <button tabIndex={-1}>Programmatic only</button>
              <a href="#excluded" tabIndex={-2}>Negative tabindex link</a>
              <input type="hidden" tabIndex={0} />
              <button disabled tabIndex={0}>Disabled</button>
              <fieldset disabled><button>Disabled by fieldset</button></fieldset>
              <button>First eligible</button>
              <button>Last eligible</button>
            </>
          )}
        />
      );

      expect(screen.getByRole('button', { name: 'First eligible' })).toHaveFocus();
    });

    it('autofocus: no eligible controls -> dialog receives focus', () => {
      renderWithModalStack(
        <Adapter
          id="no-focus-candidates"
          isOpen
          status="open"
          close={vi.fn()}
          remove={vi.fn()}
          ariaLabel="No eligible controls"
          render={() => <button tabIndex={-1}>Programmatic only</button>}
        />
      );

      expect(screen.getByRole('dialog', { name: 'No eligible controls' })).toHaveFocus();
    });

    it('autofocus: visible override inside hidden visibility -> visible child remains eligible', () => {
      renderWithModalStack(
        <Adapter
          id="visible-override"
          isOpen
          status="open"
          close={vi.fn()}
          remove={vi.fn()}
          render={() => (
            <div style={{ visibility: 'hidden', display: 'contents', opacity: 0 }}>
              <button style={{ visibility: 'visible' }}>Visible override</button>
            </div>
          )}
        />
      );

      expect(screen.getByRole('button', { name: 'Visible override' })).toHaveFocus();
    });

    it('autofocus: first legend of a disabled fieldset -> legend control remains eligible', () => {
      renderWithModalStack(
        <Adapter
          id="fieldset-legend"
          isOpen
          status="open"
          close={vi.fn()}
          remove={vi.fn()}
          render={() => (
            <fieldset disabled>
              <legend><button>Legend control</button></legend>
              <button>Disabled fieldset control</button>
            </fieldset>
          )}
        />
      );

      expect(screen.getByRole('button', { name: 'Legend control' })).toHaveFocus();
    });
  });
}

it('inline Tab boundaries: excluded leading and trailing controls -> wraps eligible controls in DOM order', () => {
  renderWithModalStack(
    <ModalAdapterInline
      id="focus-boundaries"
      isOpen
      status="open"
      close={vi.fn()}
      remove={vi.fn()}
      render={() => (
        <>
          <button tabIndex={-1}>Excluded first</button>
          <button>First eligible</button>
          <button>Last eligible</button>
          <div hidden><button>Excluded last</button></div>
        </>
      )}
    />
  );

  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

  expect(screen.getByRole('button', { name: 'Last eligible' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'First eligible' })).toHaveFocus();
});
