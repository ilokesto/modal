# @ilokesto/modal

`@ilokesto/overlay` 위에서 focus 관리와 기본 motion을 제공하는 awaitable React modal입니다.

[![npm version](https://img.shields.io/npm/v/%40ilokesto%2Fmodal?style=flat&color=555)](https://www.npmjs.com/package/@ilokesto/modal)

[English](./README.md)

- `useModal()` 또는 `modal` facade로 typed 결과를 기다립니다.
- 기본 inline과 네이티브 `<dialog>` top-layer transport를 지원합니다.
- Focus trap과 복원, dismiss 규칙, scroll lock, reduced motion을 처리합니다.

## 설치

```bash
pnpm add @ilokesto/modal react react-dom
```

## 빠른 시작

앱을 `ModalProvider`로 감싸고, `render`에서 해당 modal 전용 `close(result)`를 사용하세요.

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

항상 접근 가능한 이름을 제공하고 설명 ID를 실제 요소에 연결하세요. `render`는 순수하게 유지하고 hook이 필요하면 별도 컴포넌트를 반환하세요. 결과는 exit 후 제거될 때 정산됩니다. `onDismiss`는 Escape/backdrop 전용이고, `onModalClose`는 모든 닫기 경로를 다룹니다.

<details>
<summary>개발</summary>

이 저장소 루트에서 Node 24.22.1과 pnpm 10.17.1을 사용하세요.

API 문서를 기여할 때는 [런타임 JSDoc 계약](./JSDOC.md)을 따라 영어로 작성하세요. `pnpm lint:jsdoc`의 의미 기반 검사는 `test:tooling`과 CI에서도 실행됩니다.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm typecheck
pnpm test
```

`pnpm test` builds once and runs unit tests (`test:unit`), tooling (`test:tooling`), package validation (`test:pack`), and browser checks (`test:browser:e2e` and `test:browser:a11y` through `test:browser`). Standalone package validation requires a prior build. Tests live in `tests/unit`, `tests/tooling`, and `tests/browser`; helpers and apps live in `tests/fixtures`.


`store` 없는 기본 provider는 하나만 마운트하세요. 기본 provider는 `globalModalStore`를 공유합니다. 여러 provider를 동시에 쓴다면 각각 별도 overlay store를 전달하고 해당 트리의 hook을 사용하세요. 글로벌 `modal` facade는 항상 global store를 대상으로 합니다.

활성 네이티브 모달 위에 여는 inline 모달은 기본 transport를 포함해 투명한 네이티브 dialog 호스트를 사용합니다. 기존 inline 패널, 위치, 클래스, 스타일, backdrop, focus trap을 유지하면서 네이티브 모달 위에서 조작할 수 있습니다. 서로 다른 provider에서도 동작하며 각 provider의 스택과 dismiss 상태는 공유하지 않습니다. 호스트 선택은 제거될 때까지 유지하므로 아래 모달이 먼저 제거되어도 자식이 다시 마운트되거나 입력이 초기화되지 않습니다. 이미 마운트된 inline 모달은 나중에 네이티브 모달이 열려도 이동하지 않습니다.
호스팅된 inline 모달이 Escape를 소유하며, 먼저 닫힌 뒤 아래 네이티브 모달로 포커스를 복원합니다. 다른 provider의 네이티브 모달은 같은 Escape로 함께 닫히지 않습니다.

Inline, top-layer, 호스팅된 inline 모달은 provider에 관계없이 body 스크롤 잠금을 공유합니다. 각 모달은 closing 상태에서도 제거될 때까지 잠금을 유지합니다. 마지막 모달이 제거될 때만 첫 모달을 열기 전의 inline `overflow`, `overflow-x`, `overflow-y` 값과 우선순위를 복원합니다. provider가 열린 순서와 다르게 닫히거나 언마운트되어도 같은 규칙을 적용합니다.

`closeAll()` 자체는 callback을 알리지 않고 이후 제거 시 `onModalClose(undefined)`가 발생합니다. `reject()`는 제거 시 Promise를 거부합니다.

코드는 `ModalProvider` → `createModalStackRuntime` → `useIsTopModal` 순서로 읽으세요. 두 adapter는 `useModalExit` 타이밍과 body 스크롤 잠금을 공유하며 focus/dismiss 정책은 transport별로 유지합니다.

Top-layer는 네이티브 `<dialog>`와 `showModal()`이 필요하며 polyfill을 포함하지 않습니다.
`dialog.close()` 또는 `method="dialog"` 폼이 네이티브로 닫으면 모달을 즉시 제거합니다. modal API에서 결과나 거부를 이미 지정했다면 이를 유지하고, 그 외 결과는 `undefined`입니다. 네이티브 `returnValue`를 typed 결과로 변환하지 않습니다. `onModalClose`는 호출하지만 `onDismiss`는 호출하지 않습니다.

브라우저 테스트는 Playwright를 사용합니다. 준비: `pnpm exec playwright install chromium`. 라이선스: MIT.

</details>
