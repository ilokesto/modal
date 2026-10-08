import { describe, expect, it } from 'vitest';
import { createModalStackRuntime } from '../src/core/createModalStackRuntime';

describe('modal stack runtime', () => {
  it('keeps duplicate IDs ordered by token when a non-top entry unregisters', () => {
    const runtime = createModalStackRuntime();
    const firstToken = Symbol('duplicate');
    const secondToken = Symbol('duplicate');
    const unregisterFirst = runtime.register({
      id: 'duplicate',
      token: firstToken,
      elementRef: { current: null },
    });
    runtime.register({
      id: 'duplicate',
      token: secondToken,
      elementRef: { current: null },
    });
    expect(runtime.getStackInfo(firstToken)).toMatchObject({
      isTopModal: false,
      stackIndex: 0,
    });
    expect(runtime.getStackInfo(secondToken)).toMatchObject({
      isTopModal: true,
      stackIndex: 1,
    });

    unregisterFirst();

    expect(runtime.getStackInfo(firstToken)).toMatchObject({
      isTopModal: false,
      stackIndex: 0,
    });
    expect(runtime.getStackInfo(secondToken)).toMatchObject({
      isTopModal: true,
      stackIndex: 0,
    });
  });

  it('notifies with updated versions only for stack changes until unsubscribe', () => {
    const runtime = createModalStackRuntime();
    const versions: number[] = [];
    const unsubscribe = runtime.subscribe(() => versions.push(runtime.getVersion()));
    expect(runtime.getVersion()).toBe(0);

    const unregister = runtime.register({
      id: 'modal',
      token: Symbol('modal'),
      elementRef: { current: null },
    });
    unregister();
    unregister();
    unsubscribe();
    runtime.register({
      id: 'next-modal',
      token: Symbol('next-modal'),
      elementRef: { current: null },
    });

    expect(versions).toEqual([1, 2]);
    expect(runtime.getVersion()).toBe(3);
  });

  it('checks live element refs across the stack and excludes unregistered entries', () => {
    const runtime = createModalStackRuntime();
    const token = Symbol('modal');
    const container = document.createElement('div');
    const target = document.createElement('button');
    container.append(target);
    const elementRef: { current: HTMLElement | null } = { current: null };
    const unregister = runtime.register({ id: 'modal', token, elementRef });
    const topToken = Symbol('top');
    runtime.register({
      id: 'top',
      token: topToken,
      elementRef: { current: document.createElement('div') },
    });
    const { containsTarget } = runtime.getStackInfo(topToken);
    expect(containsTarget(target)).toBe(false);

    elementRef.current = container;

    expect(containsTarget(container)).toBe(true);
    expect(containsTarget(target)).toBe(true);
    expect(containsTarget(document.createElement('button'))).toBe(false);

    unregister();

    expect(containsTarget(target)).toBe(false);
  });
});
