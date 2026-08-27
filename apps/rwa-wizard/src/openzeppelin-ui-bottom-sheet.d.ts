/**
 * Augments the main kit barrel with BottomSheet until SF-9 publishes it.
 * Remove when `@openzeppelin/ui-components` exports BottomSheet from the registry pin.
 * Absent under `pnpm dev:local` — real exports must not be shadowed.
 */
import '@openzeppelin/ui-components';

declare module '@openzeppelin/ui-components' {
  import type React from 'react';

  export type BottomSheetHeightPx = number;

  export function defaultBottomSheetHeight(
    viewportHeightPx: number,
    options?: { readonly ratio?: number }
  ): BottomSheetHeightPx;

  export interface BottomSheetProps {
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly id?: string;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly height: BottomSheetHeightPx;
    readonly onHeightChange: (height: BottomSheetHeightPx) => void;
    readonly closeLabel?: string;
    readonly header?: React.ReactNode;
    readonly layout?: 'overlay' | 'inset';
    readonly 'aria-label'?: string;
    readonly 'aria-labelledby'?: string;
  }

  export const BottomSheet: React.ForwardRefExoticComponent<
    BottomSheetProps & React.RefAttributes<HTMLElement>
  >;
}
