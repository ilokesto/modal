import { createContext } from 'react';
import type { ModalStackRuntime } from '../core/createModalStackRuntime';

export const ModalStackRuntimeContext = createContext<ModalStackRuntime | null>(null);
