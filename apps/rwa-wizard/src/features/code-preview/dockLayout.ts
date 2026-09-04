import type { CodePreviewDockPosition } from './dockPosition';
import { isHorizontalDock } from './dockPosition';

/** Form keeps at least this much inline space when a side dock is inset. INV-11 */
export const FORM_MIN_INLINE_PX = 320;

/** Below this viewport width, horizontal docks use overlay (no host inset). INV-11 */
export const SIDE_INSET_MIN_VIEWPORT_PX = 480;

/** Top dock leaves at least this much block space for the form when tall enough. INV-26 */
export const TOP_FORM_MIN_BLOCK_PX = 160;

/** Below this viewport height, top docks use overlay. INV-26 */
export const TOP_OVERLAY_BELOW_VIEWPORT_PX = 320;

export type CodePreviewSheetLayout = 'inset' | 'overlay';

/**
 * Bottom dock uses kit `layout="inset"` so the host shrinks via
 * `--bottom-sheet-inset` and wizard CTAs stay reachable at the default
 * (non-maximized) height. Maximize on bottom is an explicit full-viewport
 * takeover (`dockAxisMaxSize` = full vh). Left, right, and top stay overlay —
 * the sheet floats over the form — but maximize still reserves
 * `FORM_MIN_INLINE_PX` / `TOP_FORM_MIN_BLOCK_PX` so the form is not buried.
 *
 * Narrow-edge thresholds remain exported for axis clamps; they no longer flip
 * layout to inset on side docks.
 *
 * Never rewrites `dockPosition` — only chooses overlay vs inset.
 */
export function resolveDockSheetLayout(
  side: CodePreviewDockPosition,
  _viewportWidth: number,
  _viewportHeight: number
): CodePreviewSheetLayout {
  return side === 'bottom' ? 'inset' : 'overlay';
}

/**
 * Axis span used as the clamp ceiling for the sheet's perpendicular size.
 * Side docks (inset or overlay) reserve `FORM_MIN_INLINE_PX` so maximize cannot
 * bury the form. Top docks reserve `TOP_FORM_MIN_BLOCK_PX` when the viewport is
 * tall enough. Bottom maximize is an explicit full-viewport takeover (full vh).
 * INV-8, INV-11, INV-26
 */
export function dockAxisMaxSize(
  side: CodePreviewDockPosition,
  _layout: CodePreviewSheetLayout,
  viewportWidth: number,
  viewportHeight: number
): number {
  if (isHorizontalDock(side)) {
    return Math.max(0, viewportWidth - FORM_MIN_INLINE_PX);
  }
  if (side === 'top' && viewportHeight >= TOP_OVERLAY_BELOW_VIEWPORT_PX) {
    return Math.max(0, viewportHeight - TOP_FORM_MIN_BLOCK_PX);
  }
  // Bottom (any layout) and short top viewports: full block axis.
  return Math.max(0, viewportHeight);
}
