/**
 * Dock-edge helpers for the code-preview sheet (SF-23).
 * Pure functions — no React, no storage.
 */

/** Physical dock edge. Default and legacy: `'bottom'`. */
export type CodePreviewDockPosition = 'top' | 'right' | 'bottom' | 'left';

/** Clockwise cycle starting at bottom — the product default. INV-3 */
export const DOCK_CYCLE_ORDER: readonly CodePreviewDockPosition[] = [
  'bottom',
  'right',
  'top',
  'left',
] as const;

/** Default dock-menu offer: every closed edge. Apps may pass a subset. */
export const ALL_DOCK_MENU_POSITIONS: readonly CodePreviewDockPosition[] = DOCK_CYCLE_ORDER;

/**
 * RWA Wizard dock menu: bottom + left only (visually sensible for this shell).
 * Persistence may still hold top/right from older builds; the tools control maps
 * those to the menu fallback via {@link resolveDockMenuSelection}.
 */
export const WIZARD_DOCK_MENU_POSITIONS: readonly CodePreviewDockPosition[] = [
  'bottom',
  'left',
] as const;

const DOCK_SET: ReadonlySet<string> = new Set(DOCK_CYCLE_ORDER);

/**
 * Which menu radio is selected for `current` given the positions the menu offers.
 * Prefer the live dock when it is offered; otherwise the `fallback` when offered;
 * otherwise the first menu entry. Empty menus leave `current` unchanged.
 */
export function resolveDockMenuSelection(
  current: CodePreviewDockPosition,
  menuPositions: readonly CodePreviewDockPosition[],
  fallback: CodePreviewDockPosition = 'bottom'
): CodePreviewDockPosition {
  if (menuPositions.length === 0) {
    return current;
  }
  if (menuPositions.includes(current)) {
    return current;
  }
  if (menuPositions.includes(fallback)) {
    return fallback;
  }
  return menuPositions[0] ?? current;
}

/** Advance one step in `DOCK_CYCLE_ORDER` (wraps). INV-3 */
export function nextDockPosition(current: CodePreviewDockPosition): CodePreviewDockPosition {
  const index = DOCK_CYCLE_ORDER.indexOf(current);
  const safeIndex = index < 0 ? 0 : index;
  return DOCK_CYCLE_ORDER[(safeIndex + 1) % DOCK_CYCLE_ORDER.length] ?? 'bottom';
}

/** Total parse: known lowercase literals only; anything else → `'bottom'`. INV-1, INV-2 */
export function parseDockPosition(raw: string | null): CodePreviewDockPosition {
  if (raw !== null && DOCK_SET.has(raw)) {
    return raw as CodePreviewDockPosition;
  }
  return 'bottom';
}

export function isVerticalDock(side: CodePreviewDockPosition): boolean {
  return side === 'top' || side === 'bottom';
}

export function isHorizontalDock(side: CodePreviewDockPosition): boolean {
  return side === 'left' || side === 'right';
}
