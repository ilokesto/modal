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
import styles from '../landings/store-landing.module.css';

const copy = {
  en: {
    title: 'Publish a release note',
    description: 'Confirm to move this sample from draft to published. Cancel keeps the draft; reset lets you try again. Nothing is sent.',
    open: 'Publish draft',
    reset: 'Reset',
    dialogTitle: 'Publish this release note?',
    dialogBody: 'This demo changes the release note below to Published. No real content is sent or published.',
    cancel: 'Cancel',
    confirm: 'Publish',
    itemTitle: 'October release notes',
    draft: 'Draft · private',
    published: 'Published · demo only',
    idle: 'Ready for review.',
    waiting: 'Waiting for a decision...',
    confirmed: 'Result: published in this demo.',
    cancelled: 'Result: cancelled. Draft kept.',
    dismissed: 'Result: dismissed. Draft kept.',
  },
  ko: {
    title: '릴리스 노트 게시하기',
    description: '확인하면 예시 초안이 게시 상태가 됩니다. 취소하면 초안이 유지되고, 초기화하면 다시 시도할 수 있습니다. 실제 전송은 없습니다.',
    open: '초안 게시',
    reset: '초기화',
    dialogTitle: '이 릴리스 노트를 게시할까요?',
    dialogBody: '아래 예시 릴리스 노트를 게시 상태로 바꿉니다. 실제 콘텐츠를 전송하거나 게시하지 않습니다.',
    cancel: '취소',
    confirm: '게시',
    itemTitle: '10월 릴리스 노트',
    draft: '초안 · 비공개',
    published: '게시됨 · 데모 전용',
    idle: '검토할 준비가 되었습니다.',
    waiting: '결정을 기다리는 중...',
    confirmed: '결과: 데모에서 게시했습니다.',
    cancelled: '결과: 취소하고 초안을 유지했습니다.',
    dismissed: '결과: 닫고 초안을 유지했습니다.',
  },
} as const;

function ModalControls({ lang }: DemoProps) {
  const text = copy[lang];
  const { clear, display } = useModal();
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState(false);
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
      if (confirmed === true) setPublished(true);
      setResult(confirmed === true ? text.confirmed : confirmed === false ? text.cancelled : text.dismissed);
    }
  };

  const reset = () => {
    runRef.current += 1;
    clear();
    setPending(false);
    setPublished(false);
    setResult(text.idle);
  };

  useEffect(() => () => {
    runRef.current += 1;
    clear();
  }, [clear]);

  return (
    <>
      <div className={styles.demoToolbar}>
        <button
          type="button"
          data-demo-action="modal-open"
          className={demoButtonClass}
          aria-disabled={pending || published}
          onClick={() => {
            if (!pending && !published) void openConfirmation();
          }}
        >
          {text.open}
        </button>
        <button
          type="button"
          data-demo-action="modal-reset"
          className={demoSecondaryButtonClass}
          onClick={reset}
        >
          {text.reset}
        </button>
      </div>
      <div className={`${styles.demoPreview} h-20 overflow-auto`}>
        <p className="text-sm font-semibold">{text.itemTitle}</p>
        <p data-demo-result="modal-document" className="text-sm">
          {published ? text.published : text.draft}
        </p>
      </div>
      <p data-demo-result="modal" role="status" className={`${styles.demoStatus} h-10 overflow-auto`}>
        {result}
      </p>
    </>
  );
}

export function ModalDemo({ lang }: DemoProps) {
  const text = copy[lang];
  const [store] = useState(createOverlayStore);
  const code = lang === 'ko'
    ? `const confirmed =\n  await display<boolean>({\n    ariaLabel: '초안을 게시할까요?',\n    render: close => (\n      <button\n        onClick={() => close(true)}>\n        게시\n      </button>\n    ),\n  });\nif (confirmed) setPublished(true);`
    : `const confirmed =\n  await display<boolean>({\n    ariaLabel: 'Publish this draft?',\n    render: close => (\n      <button\n        onClick={() => close(true)}>\n        Publish\n      </button>\n    ),\n  });\nif (confirmed) setPublished(true);`;

  return (
    <DemoFrame lang={lang} name="modal" title={text.title} description={text.description} code={code}>
      <ModalProvider store={store}>
        <div className="space-y-3"><ModalControls lang={lang} /></div>
      </ModalProvider>
    </DemoFrame>
  );
}
