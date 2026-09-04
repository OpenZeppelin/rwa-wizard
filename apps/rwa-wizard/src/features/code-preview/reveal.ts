import type { CodeViewReveal } from '@openzeppelin/ui-components/code-view';

/**
 * Inclusive, 1-indexed line range in a generated file. Same coordinates as
 * the kit's `CodeViewReveal`, owned here so wizard callers (the
 * provenance service it reads) never import a kit type into service code.
 */
export interface PreviewLineRange {
  readonly startLine: number;
  readonly endLine: number;
}

/** What a caller asks for. `range` omitted or null = open the file, mark nothing. */
export interface CodePreviewRevealTarget {
  readonly path: string;
  readonly range?: PreviewLineRange | null;
}

/**
 * A reveal that has been accepted by the hook. `treeKey` is the generate key
 * of the tree the range was computed against; the reveal is dropped when a
 * tree with a different key arrives. `requestId` is the kit retrigger token.
 * There is no `path` here: a reveal cannot exist apart from its selection.
 */
export interface PendingReveal {
  readonly range: PreviewLineRange;
  readonly requestId: number;
  readonly treeKey: string;
}

/**
 * The drawer's selection: which file, and whether a reveal is pending on it.
 * Keeping both in one value is what makes "a range paired with another file's
 * source" unrepresentable — every transition goes through one reducer.
 */
export interface PreviewSelection {
  readonly path: string | null;
  readonly reveal: PendingReveal | null;
}

export type PreviewSelectionAction =
  /** User picked a file in the tree, or a caller asked for a file-only open. */
  | { readonly type: 'select'; readonly path: string | null }
  /** Caller asked for a file and a range against the tree identified by `treeKey`. */
  | {
      readonly type: 'reveal';
      readonly path: string;
      readonly range: PreviewLineRange;
      readonly requestId: number;
      readonly treeKey: string;
    }
  /** A generate tick produced a tree; `paths` is its file set, `treeKey` its generate key. */
  | {
      readonly type: 'tree-ready';
      readonly paths: ReadonlySet<string>;
      readonly treeKey: string;
      readonly fallbackPath: string | null;
    }
  /** The drawer closed. */
  | { readonly type: 'closed' };

export const EMPTY_PREVIEW_SELECTION: PreviewSelection = { path: null, reveal: null };

/**
 * Returns `state` itself whenever the result would equal it, so `useReducer`
 * bails out and nothing downstream re-renders on a duplicate tick. INV-4 row 7.
 */
function withReveal(state: PreviewSelection, reveal: PendingReveal | null): PreviewSelection {
  return state.reveal === reveal ? state : { path: state.path, reveal };
}

/** Pure selection reducer. Implements exactly the INV-4 table; nothing else. */
export function reducePreviewSelection(
  state: PreviewSelection,
  action: PreviewSelectionAction
): PreviewSelection {
  switch (action.type) {
    case 'select': // INV-4 row 1
      return state.path === action.path && state.reveal === null
        ? state
        : { path: action.path, reveal: null };

    case 'reveal': // INV-4 row 2, INV-6: fields are copied, the action is not stored
      return {
        path: action.path,
        reveal: { range: action.range, requestId: action.requestId, treeKey: action.treeKey },
      };

    case 'tree-ready': {
      // INV-9: set membership, never `in` on a record
      if (state.path === null || !action.paths.has(state.path)) {
        return { path: action.fallbackPath, reveal: null }; // INV-4 row 5
      }
      if (state.reveal !== null && state.reveal.treeKey !== action.treeKey) {
        return withReveal(state, null); // INV-4 row 4: computed against another tree
      }
      return state; // INV-4 row 3 / row 7
    }

    case 'closed': // INV-4 row 6 / row 7
      return withReveal(state, null);

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/**
 * Kit prop from selection. `undefined` unless a reveal is pending. Copies three
 * primitives and validates nothing — range validity is the kit's contract
 * (001 SF-13 INV-6) and a second validator here would drift from it. INV-2.
 */
export function toCodeViewReveal(selection: PreviewSelection): CodeViewReveal | undefined {
  const { reveal } = selection;
  if (reveal === null) {
    return undefined;
  }
  return { startLine: reveal.range.startLine, endLine: reveal.range.endLine, id: reveal.requestId };
}
