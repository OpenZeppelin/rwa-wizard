import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

vi.mock('@openzeppelin/ui-components', () => ({
  defaultBottomSheetHeight: (viewportHeightPx: number, options?: { ratio?: number }) =>
    Math.round(
      Math.max(240, Math.min(viewportHeightPx * (options?.ratio ?? 0.6), viewportHeightPx - 80))
    ),
  Button: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  BottomSheet: ({
    children,
    header,
    open,
    id,
    'aria-label': ariaLabel,
  }: {
    children: ReactElement;
    header?: ReactNode;
    open: boolean;
    id?: string;
    'aria-label'?: string;
  }) =>
    open ? (
      <section id={id} aria-label={ariaLabel} data-testid="bottom-sheet">
        {header != null ? <div data-testid="bottom-sheet-header">{header}</div> : null}
        {children}
      </section>
    ) : null,
  Banner: ({ children }: { children: ReactNode; [key: string]: unknown }) => (
    <div role="alert">{children}</div>
  ),
}));

export {};
