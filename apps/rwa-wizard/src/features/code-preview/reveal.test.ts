import { describe, expect, it } from 'vitest';

import {
  EMPTY_PREVIEW_SELECTION,
  reducePreviewSelection,
  toCodeViewReveal,
  type PreviewSelection,
  type PreviewSelectionAction,
} from './reveal';

const RANGE = { startLine: 10, endLine: 12 } as const;

const revealed: PreviewSelection = {
  path: 'README.md',
  reveal: { range: RANGE, requestId: 1, treeKey: 'tree-a' },
};

const treeReady = (
  paths: readonly string[],
  treeKey: string,
  fallbackPath: string | null = 'Cargo.toml'
): PreviewSelectionAction => ({ type: 'tree-ready', paths: new Set(paths), treeKey, fallbackPath });

describe('reducePreviewSelection (INV-1, INV-4, INV-5, INV-6, INV-9)', () => {
  it('EMPTY_PREVIEW_SELECTION has no path and no reveal', () => {
    expect(EMPTY_PREVIEW_SELECTION).toStrictEqual({ path: null, reveal: null });
  });

  it('row 1: select(p) selects p and clears any reveal', () => {
    expect(reducePreviewSelection(revealed, { type: 'select', path: 'deploy.ts' })).toStrictEqual({
      path: 'deploy.ts',
      reveal: null,
    });
  });

  it('row 1: select(same path) still clears the reveal — plain navigation', () => {
    expect(reducePreviewSelection(revealed, { type: 'select', path: 'README.md' })).toStrictEqual({
      path: 'README.md',
      reveal: null,
    });
  });

  it('row 2: reveal(p, r, id, key) lands path and reveal in one object (INV-1, INV-6)', () => {
    const next = reducePreviewSelection(EMPTY_PREVIEW_SELECTION, {
      type: 'reveal',
      path: 'README.md',
      range: RANGE,
      requestId: 7,
      treeKey: 'tree-a',
    });
    expect(next).toStrictEqual({
      path: 'README.md',
      reveal: { range: RANGE, requestId: 7, treeKey: 'tree-a' },
    });
  });

  it('row 3: tree-ready with the same key and the path present keeps everything', () => {
    const next = reducePreviewSelection(revealed, treeReady(['README.md', 'Cargo.toml'], 'tree-a'));
    expect(next).toStrictEqual(revealed);
  });

  it('row 4: tree-ready with a different key and the path present drops only the reveal', () => {
    const next = reducePreviewSelection(revealed, treeReady(['README.md', 'Cargo.toml'], 'tree-b'));
    expect(next).toStrictEqual({ path: 'README.md', reveal: null });
  });

  it('row 5: tree-ready without the path falls back and drops the reveal', () => {
    const next = reducePreviewSelection(revealed, treeReady(['Cargo.toml'], 'tree-a'));
    expect(next).toStrictEqual({ path: 'Cargo.toml', reveal: null });
  });

  it('row 5: tree-ready on an empty selection takes the fallback (first tree)', () => {
    const next = reducePreviewSelection(
      EMPTY_PREVIEW_SELECTION,
      treeReady(['Cargo.toml'], 'tree-a')
    );
    expect(next).toStrictEqual({ path: 'Cargo.toml', reveal: null });
  });

  it('row 5: membership is set membership, so a prototype name is not in the tree (INV-9)', () => {
    const state: PreviewSelection = { path: 'toString', reveal: null };
    const next = reducePreviewSelection(state, treeReady(['Cargo.toml'], 'tree-a'));
    expect(next).toStrictEqual({ path: 'Cargo.toml', reveal: null });
  });

  it('row 6: closed keeps the path and clears the reveal', () => {
    expect(reducePreviewSelection(revealed, { type: 'closed' })).toStrictEqual({
      path: 'README.md',
      reveal: null,
    });
  });

  describe('row 7: no-op transitions return the same reference', () => {
    it('tree-ready with the same key and path present', () => {
      const action = treeReady(['README.md'], 'tree-a');
      expect(reducePreviewSelection(revealed, action)).toBe(revealed);
    });

    it('closed when no reveal is pending', () => {
      const state: PreviewSelection = { path: 'README.md', reveal: null };
      expect(reducePreviewSelection(state, { type: 'closed' })).toBe(state);
    });

    it('select(p) when p is already selected with no reveal', () => {
      const state: PreviewSelection = { path: 'README.md', reveal: null };
      expect(reducePreviewSelection(state, { type: 'select', path: 'README.md' })).toBe(state);
    });

    it('tree-ready with the path present and no reveal pending, any key', () => {
      const state: PreviewSelection = { path: 'README.md', reveal: null };
      expect(reducePreviewSelection(state, treeReady(['README.md'], 'tree-z'))).toBe(state);
    });
  });

  it('rejects an action outside the union at compile time', () => {
    // @ts-expect-error -- 'clear' is not a PreviewSelectionAction
    const bad: PreviewSelectionAction = { type: 'clear' };
    expect(bad).toBeDefined();
  });
});

describe('toCodeViewReveal (INV-2, INV-17)', () => {
  it('returns undefined when no reveal is pending', () => {
    expect(toCodeViewReveal(EMPTY_PREVIEW_SELECTION)).toBeUndefined();
    expect(toCodeViewReveal({ path: 'README.md', reveal: null })).toBeUndefined();
  });

  it('projects exactly startLine, endLine and id from the pending reveal', () => {
    expect(toCodeViewReveal(revealed)).toStrictEqual({ startLine: 10, endLine: 12, id: 1 });
  });

  it.each([
    ['inverted', { startLine: 12, endLine: 10 }],
    ['zero start', { startLine: 0, endLine: 3 }],
    ['non-integer', { startLine: 1.5, endLine: 2 }],
    ['negative', { startLine: -1, endLine: 2 }],
    ['NaN', { startLine: Number.NaN, endLine: 2 }],
    ['Infinity', { startLine: 1, endLine: Number.POSITIVE_INFINITY }],
    ['past any file end', { startLine: 1, endLine: 1_000_000 }],
  ])('passes a %s range through untouched — validity is the kit contract', (_label, range) => {
    const selection: PreviewSelection = {
      path: 'README.md',
      reveal: { range, requestId: 3, treeKey: 'tree-a' },
    };
    expect(toCodeViewReveal(selection)).toStrictEqual({
      startLine: range.startLine,
      endLine: range.endLine,
      id: 3,
    });
  });
});
