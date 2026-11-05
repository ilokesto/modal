import type { OverlayRenderProps } from '@ilokesto/overlay';

/** Requests closing with an optional result; the display promise settles after removal. */
export type ModalClose<TResult = unknown> = (result?: TResult) => void;

/** Receives one close notification per modal, including undefined for dismissal. */
export type ModalCloseHandler<TResult = unknown> = (result?: TResult) => void;

/** Lifecycle context passed to the pure modal content renderer. */
export interface ModalRenderContext<TResult = unknown> {
  /** Stable overlay identifier for this modal. */
  id: string;
  /** Current lifecycle phase; closing content remains mounted until exit completes. */
  status: 'open' | 'closing';
  /** Whether this modal is currently in the open phase. */
  isOpen: boolean;
  /** Closes this modal with an optional typed result. */
  close: ModalClose<TResult>;
}

/** Pure content renderer; put hooks in a separate component returned by this callback. */
export type ModalRender<TResult = unknown> = (
  close: ModalClose<TResult>,
  context: ModalRenderContext<TResult>
) => React.ReactNode;

/** Supported panel positions for inline and native dialog transports. */
export type ModalPosition = 
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface ModalBaseProps<TResult = unknown> {
  /** Rendering transport; inline is the default and uses a native host when opened above an active native modal. */
  transport?: 'inline' | 'top-layer';
  /** Panel position; defaults to center. */
  position?: ModalPosition;
  /** Accessible dialog role; defaults to dialog. */
  role?: 'dialog' | 'alertdialog';
  /** Accessible name when no labelled-by element is supplied. */
  ariaLabel?: string;
  /** Space-separated IDs of mounted elements naming the dialog. */
  ariaLabelledBy?: string;
  /** Space-separated IDs of mounted elements describing the dialog. */
  ariaDescribedBy?: string;
  /** Whether top-modal Escape and backdrop interactions close the modal; defaults to true. */
  dismissible?: boolean;
  /** Callback for Escape or backdrop dismissal, before closing. */
  onDismiss?: () => void;
  /** Once-per-modal close notification, including programmatic close paths. */
  onModalClose?: ModalCloseHandler<TResult>;
  /** Panel class names. */
  className?: string;
  /** Panel inline styles overriding default motion and positioning styles. */
  style?: React.CSSProperties;
  /** Backdrop class names; top-layer attaches these to the dialog. */
  backdropClassName?: string;
  /** Backdrop styles; top-layer serializes these into a scoped backdrop rule. */
  backdropStyle?: React.CSSProperties;
  /** Whether the adapter explicitly focuses the first eligible descendant; defaults to true. Native dialog focus may still move when false. */
  autoFocus?: boolean;
  /** Whether to restore the previous connected focus target on unmount; defaults to true. */
  restoreFocus?: boolean;
}

/** Modal presentation options and its required pure content renderer. */
export type ModalProps<TResult = unknown> = ModalBaseProps<TResult> & {
  /** Renders content with its modal-scoped close callback and lifecycle context. */
  render: ModalRender<TResult>;
};

/** Modal options combined with externally owned overlay render controls. */
export type ModalAdapterProps<TResult = unknown> = OverlayRenderProps<TResult> & ModalProps<TResult>;
