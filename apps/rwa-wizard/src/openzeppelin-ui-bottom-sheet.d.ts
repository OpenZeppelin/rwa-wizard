/**
 * Augments the main kit barrel with BottomSheet until SF-9 publishes it.
 * Remove when `@openzeppelin/ui-components` exports BottomSheet from the registry pin.
 *
 * This augmentation applies even when the real export resolves, including under
 * `pnpm dev:local` — nothing removes this file. `pnpm typecheck` therefore also
 * runs `scripts/typecheck-real-kit.mjs`, which re-runs `tsc` with this file
 * excluded whenever the real subpaths resolve. Keep the shape below faithful to
 * the kit or that second pass fails.
 */
import '@openzeppelin/ui-components';

declare module '@openzeppelin/ui-components' {
  import type React from 'react';

  export type BottomSheetHeightPx = number;

  export function defaultBottomSheetHeight(
    viewportHeightPx: number,
    options?: { readonly ratio?: number }
  ): BottomSheetHeightPx;

  export type BottomSheetAccessibleName =
    | { 'aria-label': string; 'aria-labelledby'?: undefined }
    | { 'aria-labelledby': string; 'aria-label'?: undefined };

  export type BottomSheetProps = BottomSheetAccessibleName & {
    children: React.ReactNode;
    className?: string;
    id?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    height: BottomSheetHeightPx;
    onHeightChange: (height: BottomSheetHeightPx) => void;
    closeLabel?: string;
    header?: React.ReactNode;
    layout?: 'overlay' | 'inset';
  };

  export const BottomSheet: React.ForwardRefExoticComponent<
    BottomSheetProps & React.RefAttributes<HTMLElement>
  >;
}
