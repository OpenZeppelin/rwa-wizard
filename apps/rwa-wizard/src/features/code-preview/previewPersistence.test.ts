import { describe, expect, it } from 'vitest';

import {
  CODE_PREVIEW_HEIGHT_STORAGE_KEY,
  CODE_PREVIEW_OPEN_STORAGE_KEY,
  readCodePreviewPersistence,
  writeCodePreviewHeight,
  writeCodePreviewOpen,
} from './previewPersistence';

describe('previewPersistence (INV-12)', () => {
  it('reads and writes only open and height keys', () => {
    writeCodePreviewOpen(true);
    writeCodePreviewHeight(420);

    const state = readCodePreviewPersistence();
    expect(state.open).toBe(true);
    expect(state.height).toBe(420);

    expect(localStorage.getItem(CODE_PREVIEW_OPEN_STORAGE_KEY)).toBe('true');
    expect(localStorage.getItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY)).toBe('420');
    expect(localStorage.length).toBe(2);
  });

  it('falls back when stored height is invalid', () => {
    localStorage.setItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY, 'not-a-number');
    const state = readCodePreviewPersistence();
    expect(state.height).toBeGreaterThan(0);
  });
});
