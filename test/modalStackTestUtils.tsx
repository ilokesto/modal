import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { createModalStackRuntime } from '../src/core/createModalStackRuntime';
import { ModalStackRuntimeContext } from '../src/shared/ModalStackRuntimeContext';

function ModalStackTestProvider({ children }: { readonly children: ReactNode }) {
  const runtime = useMemo(createModalStackRuntime, []);

  return (
    <ModalStackRuntimeContext.Provider value={runtime}>
      {children}
    </ModalStackRuntimeContext.Provider>
  );
}

export function renderWithModalStack(element: ReactElement) {
  return render(element, { wrapper: ModalStackTestProvider });
}
