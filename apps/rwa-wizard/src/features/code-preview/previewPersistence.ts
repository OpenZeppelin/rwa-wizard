import { defaultBottomSheetHeight } from '@openzeppelin/ui-components';

export const CODE_PREVIEW_OPEN_STORAGE_KEY = 'rwa-wizard:code-preview:open';
/**
 * Suffix bumped when the default height changes, so existing browsers re-seed at the new
 * default once instead of keeping a height dragged under the old one (v1 = 60% era).
 */
export const CODE_PREVIEW_HEIGHT_STORAGE_KEY = 'rwa-wizard:code-preview:height:v2';

/** Share of the viewport the drawer opens at before the user has resized it. */
export const CODE_PREVIEW_DEFAULT_HEIGHT_RATIO = 0.5;

export const CODE_PREVIEW_TREE_STORAGE_KEY = 'rwa-wizard:code-preview:tree';

export interface CodePreviewPersistenceState {
  readonly open: boolean;
  readonly height: number;
  /** File tree pane shown beside the code pane. Default true. */
  readonly treeVisible: boolean;
}

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // INV-12: persistence is best-effort; corrupt storage falls back to defaults.
  }
  return fallback;
}

function readHeight(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    // INV-12
  }
  return fallback;
}

/** Read persisted drawer chrome. Height defaults via kit clamp helper. */
export function readCodePreviewPersistence(): CodePreviewPersistenceState {
  const defaultHeight =
    typeof window !== 'undefined'
      ? defaultBottomSheetHeight(window.innerHeight, { ratio: CODE_PREVIEW_DEFAULT_HEIGHT_RATIO })
      : defaultBottomSheetHeight(800, { ratio: CODE_PREVIEW_DEFAULT_HEIGHT_RATIO });

  return {
    open: readBoolean(CODE_PREVIEW_OPEN_STORAGE_KEY, false),
    height: readHeight(CODE_PREVIEW_HEIGHT_STORAGE_KEY, defaultHeight),
    treeVisible: readBoolean(CODE_PREVIEW_TREE_STORAGE_KEY, true),
  };
}

export function writeCodePreviewOpen(open: boolean): void {
  try {
    localStorage.setItem(CODE_PREVIEW_OPEN_STORAGE_KEY, String(open));
  } catch {
    // INV-12: ignore quota / private-mode failures.
  }
}

export function writeCodePreviewTreeVisible(visible: boolean): void {
  try {
    localStorage.setItem(CODE_PREVIEW_TREE_STORAGE_KEY, String(visible));
  } catch {
    // INV-12
  }
}

export function writeCodePreviewHeight(height: number): void {
  try {
    localStorage.setItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY, String(height));
  } catch {
    // INV-12
  }
}
