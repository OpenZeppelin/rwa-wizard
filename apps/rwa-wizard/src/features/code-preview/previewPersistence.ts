/**
 * Drawer chrome preferences (open, height, width, tree, dock edge).
 *
 * Stored in `localStorage`, not in the app's `@openzeppelin/ui-storage`
 * (IndexedDB) database, and that is a recorded deviation from the constitution's
 * Principle VI wording ("user preferences" via ui-storage), accepted for these
 * five scalars because:
 *
 * - they are read synchronously on first render to size the sheet; an async
 *   IndexedDB hydration would paint the default chrome first and then jump;
 * - the Storage constraint ("no complex data in localStorage") is met — every
 *   value is a boolean, a number or a four-literal enum with a total parser and
 *   a fallback;
 * - nothing here is user data: losing it costs one resize, not a draft.
 *
 * Revisit if the kit or ui-storage grows a synchronous preferences layer. See
 * docs/rwa-wizard/field-impact/known-limits.md ("Drawer preferences in localStorage").
 */
import { defaultBottomSheetHeight } from '@openzeppelin/ui-components';

import {
  parseDockPosition,
  resolveDockMenuSelection,
  WIZARD_DOCK_MENU_POSITIONS,
  type CodePreviewDockPosition,
} from './dockPosition';

function defaultSheetSize(viewport: number, ratio: number): number {
  if (typeof defaultBottomSheetHeight === 'function') {
    return defaultBottomSheetHeight(viewport, { ratio });
  }
  return Math.round(viewport * ratio);
}

export const CODE_PREVIEW_OPEN_STORAGE_KEY = 'rwa-wizard:code-preview:open';
/**
 * Suffix bumped when the default height changes, so existing browsers re-seed at the new
 * default once instead of keeping a height dragged under the old one (v1 = 60% era).
 */
export const CODE_PREVIEW_HEIGHT_STORAGE_KEY = 'rwa-wizard:code-preview:height:v2';

/** Share of the viewport the drawer opens at before the user has resized it. */
export const CODE_PREVIEW_DEFAULT_HEIGHT_RATIO = 0.5;

export const CODE_PREVIEW_TREE_STORAGE_KEY = 'rwa-wizard:code-preview:tree';

/** Last chosen dock edge. INV-4 */
export const CODE_PREVIEW_DOCK_STORAGE_KEY = 'rwa-wizard:code-preview:dock';

/** Perpendicular size for left/right docks. INV-4 */
export const CODE_PREVIEW_WIDTH_STORAGE_KEY = 'rwa-wizard:code-preview:width:v1';

/** Default share of the inline viewport for a fresh side dock. INV-27 */
export const CODE_PREVIEW_DEFAULT_WIDTH_RATIO = 0.5;

export interface CodePreviewPersistenceState {
  readonly open: boolean;
  /** Perpendicular size for top/bottom docks. */
  readonly height: number;
  /** Perpendicular size for left/right docks. */
  readonly width: number;
  /** File tree pane shown beside the code pane. Default true. */
  readonly treeVisible: boolean;
  /** Last chosen dock edge. */
  readonly dockPosition: CodePreviewDockPosition;
}

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // Historical INV-12 / SF-23 INV-6: persistence is best-effort.
  }
  return fallback;
}

function readPositiveNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    // INV-6
  }
  return fallback;
}

function readDock(key: string): CodePreviewDockPosition {
  try {
    return parseDockPosition(localStorage.getItem(key));
  } catch {
    // INV-6
    return 'bottom';
  }
}

/** Read persisted drawer chrome. Height/width defaults via kit clamp helper. */
export function readCodePreviewPersistence(): CodePreviewPersistenceState {
  const defaultHeight =
    typeof window !== 'undefined'
      ? defaultSheetSize(window.innerHeight, CODE_PREVIEW_DEFAULT_HEIGHT_RATIO)
      : defaultSheetSize(800, CODE_PREVIEW_DEFAULT_HEIGHT_RATIO);

  const defaultWidth =
    typeof window !== 'undefined'
      ? defaultSheetSize(window.innerWidth, CODE_PREVIEW_DEFAULT_WIDTH_RATIO)
      : defaultSheetSize(1280, CODE_PREVIEW_DEFAULT_WIDTH_RATIO);

  const storedDock = readDock(CODE_PREVIEW_DOCK_STORAGE_KEY);
  // Legacy top/right from older builds map to the wizard menu fallback in memory
  // only — storage is rewritten only on an explicit dock pick (B-9).
  const dockPosition = resolveDockMenuSelection(storedDock, WIZARD_DOCK_MENU_POSITIONS);

  return {
    open: readBoolean(CODE_PREVIEW_OPEN_STORAGE_KEY, false),
    height: readPositiveNumber(CODE_PREVIEW_HEIGHT_STORAGE_KEY, defaultHeight),
    width: readPositiveNumber(CODE_PREVIEW_WIDTH_STORAGE_KEY, defaultWidth),
    treeVisible: readBoolean(CODE_PREVIEW_TREE_STORAGE_KEY, true),
    dockPosition,
  };
}

export function writeCodePreviewOpen(open: boolean): void {
  try {
    localStorage.setItem(CODE_PREVIEW_OPEN_STORAGE_KEY, String(open));
  } catch {
    // INV-6
  }
}

export function writeCodePreviewTreeVisible(visible: boolean): void {
  try {
    localStorage.setItem(CODE_PREVIEW_TREE_STORAGE_KEY, String(visible));
  } catch {
    // INV-6
  }
}

export function writeCodePreviewHeight(height: number): void {
  try {
    localStorage.setItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY, String(height));
  } catch {
    // INV-6
  }
}

export function writeCodePreviewWidth(width: number): void {
  try {
    localStorage.setItem(CODE_PREVIEW_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // INV-6
  }
}

export function writeCodePreviewDock(position: CodePreviewDockPosition): void {
  try {
    localStorage.setItem(CODE_PREVIEW_DOCK_STORAGE_KEY, position);
  } catch {
    // INV-6
  }
}
