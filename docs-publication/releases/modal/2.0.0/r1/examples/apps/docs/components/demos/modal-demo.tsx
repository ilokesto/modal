'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createOverlayStore } from '@ilokesto/overlay';
import { ModalProvider, useModal } from '@ilokesto/modal';
import {
  DemoFrame,
  demoButtonClass,
  demoSecondaryButtonClass,
  type DemoProps,
} from './demo-frame';

const copy = {
  en: {
    title: 'Await an accessible confirmation',
    description: 'Confirm or cancel with the buttons, Escape, or the backdrop. The awaited result remains visible after the dialog is cleaned up.',
    open: 'Open confirmation',
    reset: 'Reset',
    dialogTitle: 'Publish this draft?',
    dialogBody: 'The draft will become visible to everyone with access to this project.',
    cancel: 'Cancel',
    confirm: 'Publish',
    idle: 'No decision yet.',
    waiting: 'Waiting for a decision...',
    confirmed: 'Result: confirmed.',
    cancelled: 'Result: cancelled.',
    dismissed: 'Result: dismissed with Escape or the backdrop.',
  },
  ko: {
    title: '접근 가능한 확인창의 결과 기다리기',
    description: '버튼, Escape 키 또는 배경을 눌러 결정합니다. 대화상자가 닫혀 정리된 뒤에도 기다린 결과가 화면에 남습니다.',
    open: '확인창 열기',
    reset: '초기화',
    dialogTitle: '이 초안을 게시할까요?',
    dialogBody: '이 프로젝트에 접근할 수 있는 모든 사용자에게 초안이 공개됩니다.',
    cancel: '취소',
    confirm: '게시',
    idle: '아직 결정하지 않았습니다.',
    waiting: '결정을 기다리는 중...',
    confirmed: '결과: 확인했습니다.',
    cancelled: '결과: 취소했습니다.',
    dismissed: '결과: Escape 또는 배경으로 닫았습니다.',
  },
} as const;

function ModalControls({ lang }: DemoProps) {
  const text = copy[lang];
  const { clear, display } = useModal();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string>(text.idle);
  const runRef = useRef(0);
  const reactId = useId().replace(/:/g, '');
  const titleId = `modal-demo-title-${reactId}`;
  const descriptionId = `modal-demo-description-${reactId}`;

  const openConfirmation = async () => {
    const run = ++runRef.current;
    setPending(true);
    setResult(text.waiting);

    const confirmed = await display<boolean>({
      id: `modal-demo-${reactId}`,
      ariaLabelledBy: titleId,
      ariaDescribedBy: descriptionId,
      dismissible: true,
      render: (close) => (
        <section className="w-[min(26rem,calc(100vw-2rem))] rounded-sm border border-fd-border bg-fd-card p-5 text-fd-card-foreground shadow-xl shadow-fd-foreground/10 sm:p-6">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">{text.dialogTitle}</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-fd-muted-foreground">{text.dialogBody}</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              data-demo-action="modal-cancel"
              className={`${demoSecondaryButtonClass} w-full sm:w-auto`}
              onClick={() => close(false)}
            >
              {text.cancel}
            </button>
            <button
              type="button"
              data-demo-action="modal-confirm"
              className={`${demoButtonClass} w-full sm:w-auto`}
              onClick={() => close(true)}
            >
              {text.confirm}
            </button>
          </div>
        </section>
      ),
    });

    if (run === runRef.current) {
      setPending(false);
      setResult(confirmed === true ? text.confirmed : confirmed === false ? text.cancelled : text.dismissed);
    }
  };

  const reset = () => {
    runRef.current += 1;
    clear();
    setPending(false);
    setResult(text.idle);
  };

  useEffect(() => () => {
    runRef.current += 1;
    clear();
  }, [clear]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          data-demo-action="modal-open"
          className={`${demoButtonClass} w-full sm:w-auto`}
          aria-disabled={pending}
          onClick={() => {
            if (!pending) void openConfirmation();
          }}
        >
          {text.open}
        </button>
        <button
          type="button"
          data-demo-action="modal-reset"
          className={`${demoSecondaryButtonClass} w-full sm:w-auto`}
          onClick={reset}
        >
          {text.reset}
        </button>
      </div>
      <p data-demo-result="modal" aria-live="polite" className="text-sm text-fd-muted-foreground">
        {result}
      </p>
    </>
  );
}

export function ModalDemo({ lang }: DemoProps) {
  const text = copy[lang];
  const [store] = useState(createOverlayStore);
  const code = lang === 'ko'
    ? `const confirmed = await display<boolean>({\n  ariaLabelledBy: 'publish-title',\n  ariaDescribedBy: 'publish-description',\n  render: (close) => (\n    <section>\n      <h2 id="publish-title">초안을 게시할까요?</h2>\n      <p id="publish-description">모든 사용자에게 공개됩니다.</p>\n      <button onClick={() => close(false)}>취소</button>\n      <button onClick={() => close(true)}>게시</button>\n    </section>\n  ),\n});`
    : `const confirmed = await display<boolean>({\n  ariaLabelledBy: 'publish-title',\n  ariaDescribedBy: 'publish-description',\n  render: (close) => (\n    <section>\n      <h2 id="publish-title">Publish this draft?</h2>\n      <p id="publish-description">Make it visible to everyone.</p>\n      <button onClick={() => close(false)}>Cancel</button>\n      <button onClick={() => close(true)}>Publish</button>\n    </section>\n  ),\n});`;

  return (
    <DemoFrame lang={lang} name="modal" title={text.title} description={text.description} code={code}>
        <div className="space-y-4">
          <ModalProvider store={store}>
            <div className="space-y-5"><ModalControls lang={lang} /></div>
          </ModalProvider>
        </div>
    </DemoFrame>
  );
}
