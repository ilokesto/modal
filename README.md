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

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
```

`pnpm test` builds once and runs unit tests (`test:unit`), tooling (`test:tooling`), package validation (`test:pack`), and browser checks (`test:browser:e2e` and `test:browser:a11y` through `test:browser`). Standalone package validation requires a prior build. Tests live in `tests/unit`, `tests/tooling`, and `tests/browser`; helpers and apps live in `tests/fixtures`.


Mount only one default provider without `store`: defaults share `globalModalStore`. For simultaneous providers, pass each a distinct overlay store and use hooks in its tree. The global `modal` facade always targets the global store.

`closeAll()` does not notify callbacks itself; later removal invokes `onModalClose(undefined)`. `reject()` rejects the promise on removal.

Read `ModalProvider` → `createModalStackRuntime` → `useIsTopModal`. Both adapters share `useModalExit` timing, not their transport-specific focus or dismissal policies.

Top-layer requires native `<dialog>` and `showModal()` support; no polyfill is included.

Browser tests use Playwright. Setup: `pnpm exec playwright install chromium`. License: MIT.

</details>
