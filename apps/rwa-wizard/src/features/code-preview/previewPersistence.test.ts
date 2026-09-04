import { describe, expect, it, vi } from 'vitest';

import {
  CODE_PREVIEW_DOCK_STORAGE_KEY,
  CODE_PREVIEW_HEIGHT_STORAGE_KEY,
  CODE_PREVIEW_OPEN_STORAGE_KEY,
  CODE_PREVIEW_TREE_STORAGE_KEY,
  CODE_PREVIEW_WIDTH_STORAGE_KEY,
  readCodePreviewPersistence,
  writeCodePreviewDock,
  writeCodePreviewHeight,
  writeCodePreviewOpen,
  writeCodePreviewTreeVisible,
  writeCodePreviewWidth,
} from './previewPersistence';

describe('previewPersistence open/height/tree (legacy INV-12 / SF-23 INV-6)', () => {
  it('reads and writes open, height, and tree visibility keys', () => {
    writeCodePreviewOpen(true);
    writeCodePreviewHeight(420);
    writeCodePreviewTreeVisible(false);

    const state = readCodePreviewPersistence();
    expect(state.open).toBe(true);
    expect(state.height).toBe(420);
    expect(state.treeVisible).toBe(false);

    expect(localStorage.getItem(CODE_PREVIEW_OPEN_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY)).toBe('420');
    expect(localStorage.getItem(CODE_PREVIEW_TREE_STORAGE_KEY)).toBe('false');
  });

  it('falls back when stored height is invalid', () => {
    localStorage.setItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY, 'not-a-number');
    const state = readCodePreviewPersistence();
    expect(state.height).toBeGreaterThan(0);
  });
});

describe('previewPersistence dock + width (INV-4, INV-6, INV-27)', () => {
  it('round-trips dock and width without rewriting height (INV-4)', () => {
    writeCodePreviewHeight(420);
    writeCodePreviewDock('right');
    writeCodePreviewWidth(640);

    const state = readCodePreviewPersistence();
    expect(state.dockPosition).toBe('bottom');
    expect(state.width).toBe(640);
    expect(state.height).toBe(420);

    expect(localStorage.getItem(CODE_PREVIEW_DOCK_STORAGE_KEY)).toBe('right');
    expect(localStorage.getItem(CODE_PREVIEW_WIDTH_STORAGE_KEY)).toBe('640');
    expect(localStorage.getItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY)).toBe('420');
  });

  it('normalizes legacy top/right to bottom in memory without rewriting storage (B-9)', () => {
    localStorage.setItem(CODE_PREVIEW_DOCK_STORAGE_KEY, 'top');
    const state = readCodePreviewPersistence();
    expect(state.dockPosition).toBe('bottom');
    expect(localStorage.getItem(CODE_PREVIEW_DOCK_STORAGE_KEY)).toBe('top');
  });

  it('defaults missing dock to bottom and missing width to ~50% viewport (INV-1, INV-27)', () => {
    localStorage.removeItem(CODE_PREVIEW_DOCK_STORAGE_KEY);
    localStorage.removeItem(CODE_PREVIEW_WIDTH_STORAGE_KEY);
    const state = readCodePreviewPersistence();
    expect(state.dockPosition).toBe('bottom');
    expect(state.width).toBe(Math.round(window.innerWidth * 0.5));
  });

  it('maps corrupt dock and non-positive width to safe defaults (INV-2, INV-6)', () => {
    localStorage.setItem(CODE_PREVIEW_DOCK_STORAGE_KEY, 'BOTTOM');
    localStorage.setItem(CODE_PREVIEW_WIDTH_STORAGE_KEY, '-12');
    const state = readCodePreviewPersistence();
    expect(state.dockPosition).toBe('bottom');
    expect(state.width).toBeGreaterThan(0);
  });

  it('never throws when localStorage setItem fails (INV-6)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => writeCodePreviewDock('left')).not.toThrow();
    expect(() => writeCodePreviewWidth(300)).not.toThrow();
    expect(() => writeCodePreviewHeight(300)).not.toThrow();
    spy.mockRestore();
  });

  it('never throws when localStorage getItem fails (INV-6)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => readCodePreviewPersistence()).not.toThrow();
    const state = readCodePreviewPersistence();
    expect(state.dockPosition).toBe('bottom');
    expect(state.height).toBeGreaterThan(0);
    expect(state.width).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
