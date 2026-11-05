# @ilokesto/modal

Awaitable React modals with focus management and default motion, built on `@ilokesto/overlay`.

[![npm version](https://img.shields.io/npm/v/%40ilokesto%2Fmodal?style=flat&color=555)](https://www.npmjs.com/package/@ilokesto/modal)

[한국어](./README.ko.md)

- Await typed results through `useModal()` or the `modal` facade.
- Choose default inline rendering or native `<dialog>` top-layer transport.
- Built-in focus containment and restoration, dismissal, scroll locking, and reduced motion.

## Installation

```bash
pnpm add @ilokesto/modal react react-dom
```

## Quick start

Wrap the app in `ModalProvider`; the `render` callback receives a `close(result)` scoped to that modal.

```tsx
import { ModalProvider, useModal } from '@ilokesto/modal';

function ConfirmButton() {
  const { display } = useModal();

  async function confirm() {
    const confirmed = await display<boolean>({
      id: 'delete-confirm',
      ariaLabelledBy: 'delete-title',
      ariaDescribedBy: 'delete-description',
      render: (close) => (
        <section style={{ padding: 24, background: 'Canvas', color: 'CanvasText' }}>
          <h2 id="delete-title">Delete item?</h2>
          <p id="delete-description">This action cannot be undone.</p>
          <button onClick={() => close(false)}>Cancel</button>
          <button onClick={() => close(true)}>Delete</button>
        </section>
      ),
    });
    console.log(confirmed);
  }

  return <button onClick={() => void confirm()}>Open modal</button>;
}

export function App() {
  return (
    <ModalProvider>
      <ConfirmButton />
    </ModalProvider>
  );
}
```

Always provide an accessible name and connect description ids to real elements. Keep `render` pure; return a separate component when hooks are needed. Results settle on removal after exit. `onDismiss` covers Escape/backdrop only; `onModalClose` covers all close paths.

<details>
<summary>Development</summary>

Use Node 24.22.1 and pnpm 10.17.1 from this repository root.

Follow the [runtime JSDoc contract](./JSDOC.md) when contributing API documentation. Run `pnpm lint:jsdoc`; the same semantic check runs in `test:tooling` and CI.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
```

`pnpm test` builds once and runs unit tests (`test:unit`), tooling (`test:tooling`), package validation (`test:pack`), and browser checks (`test:browser:e2e` and `test:browser:a11y` through `test:browser`). Standalone package validation requires a prior build. Tests live in `tests/unit`, `tests/tooling`, and `tests/browser`; helpers and apps live in `tests/fixtures`.


Mount only one default provider without `store`: defaults share `globalModalStore`. For simultaneous providers, pass each a distinct overlay store and use hooks in its tree. The global `modal` facade always targets the global store.

An inline modal, including the default transport, opened above an active native modal uses a transparent native dialog host. Its inline panel, position, classes, styles, backdrop and focus trap remain intact, while the host makes it operable above the native modal. This works across distinct providers without sharing their stack or dismissal state. The hosting choice lasts until removal, so removing the underlying modal does not remount the child or reset its content. Already-mounted inline modals are not moved when a later native modal opens.
The hosted inline modal owns Escape: it closes first and restores focus to the underlying native modal. A native modal in another provider is not dismissed by the same Escape.

Inline, top-layer and hosted inline modals share one body scroll lock across providers. Each mounted modal keeps its lock through closing until removal. Only the last removal restores the inline `overflow`, `overflow-x` and `overflow-y` values and priorities captured before the first modal opened, including when providers close or unmount out of order.

`closeAll()` does not notify callbacks itself; later removal invokes `onModalClose(undefined)`. `reject()` rejects the promise on removal.
Once a modal is closing, further `close` or `reject` calls neither change its result nor notify. Accepted close/reject operations record their state before invoking `onModalClose`; remove/clear remove their captured items before invoking remaining callbacks. Reentrant callbacks can remove a closing modal or open a new request without changing the old settlement or accidentally removing the new request.
Committed operations still invoke their captured callbacks if a store subscriber throws, then rethrow the original store error. `clear` attempts every captured callback even if one throws. Without a store error, a single callback error is rethrown unchanged and multiple callback errors are reported as an `AggregateError`.

Read `ModalProvider` → `createModalStackRuntime` → `useIsTopModal`. Both adapters share `useModalExit` timing and body scroll locking; focus and dismissal policies remain transport-specific.

Top-layer requires native `<dialog>` and `showModal()` support; no polyfill is included.
`backdropStyle` follows React inline style semantics in both transports: numeric lengths receive `px`, unitless properties stay unitless, strings retain their CSS units, and custom property names remain case-sensitive. Top-layer lets React normalize the styles on a hidden carrier, then copies parsed CSSOM declarations into its scoped `::backdrop` rule before paint. Values are never interpolated into stylesheet text. Updating or removing the styles clears previous declarations; browser support determines which vendor properties apply.
If `dialog.close()` or a `method="dialog"` form closes it natively, the modal is removed immediately. The result is `undefined` unless a result or rejection was already set through the modal API; the native `returnValue` is not converted to a typed result. This calls `onModalClose`, but not `onDismiss`.

Browser tests use Playwright. Setup: `pnpm exec playwright install chromium`. License: MIT.

</details>
