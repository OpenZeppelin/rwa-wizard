import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestCodegenService } from '../../../services/codegen';
import {
  defaultPreviewHookOptions,
  waitForPreviewReady,
} from '../../../test/helpers/codePreviewHarness';
import { dockAxisMaxSize, FORM_MIN_INLINE_PX, resolveDockSheetLayout } from '../dockLayout';
import { DOCK_CYCLE_ORDER, nextDockPosition } from '../dockPosition';
import {
  CODE_PREVIEW_DOCK_STORAGE_KEY,
  CODE_PREVIEW_HEIGHT_STORAGE_KEY,
  CODE_PREVIEW_TREE_STORAGE_KEY,
  CODE_PREVIEW_WIDTH_STORAGE_KEY,
  writeCodePreviewHeight,
  writeCodePreviewWidth,
} from '../previewPersistence';
import type { UseCodePreviewOptions } from './useCodePreview';
import { useCodePreview } from './useCodePreview';

/**
 * SF-23 dock layout behaviour on the preview hook:
 * INV-5 (axis exclusivity), INV-8 (maximize per axis), INV-9 (tree unchanged),
 * INV-16 (cycle while maximized), INV-17 (closed-cycle persist), INV-22 (stable sheetId),
 * INV-27 (default width ratio).
 */

function clearDockKeys(): void {
  localStorage.removeItem(CODE_PREVIEW_DOCK_STORAGE_KEY);
  localStorage.removeItem(CODE_PREVIEW_WIDTH_STORAGE_KEY);
  localStorage.removeItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY);
  localStorage.removeItem(CODE_PREVIEW_TREE_STORAGE_KEY);
}

describe('useCodePreview dock (SF-23)', () => {
  it('sets dock position directly via onDockPositionChange', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.layout.onDockPositionChange('left');
    });
    expect(result.current.layout.dockPosition).toBe('left');
    expect(result.current.persistence.dockPosition).toBe('left');
    expect(localStorage.getItem(CODE_PREVIEW_DOCK_STORAGE_KEY)).toBe('left');
  });

  it('defaults dock to bottom and cycles the 4-edge orbit (INV-1, INV-3)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    expect(result.current.persistence.dockPosition).toBe('bottom');
    expect(result.current.layout.dockPosition).toBe('bottom');

    for (const expected of ['right', 'top', 'left', 'bottom'] as const) {
      act(() => {
        result.current.layout.onCycleDock();
      });
      expect(result.current.layout.dockPosition).toBe(expected);
      expect(localStorage.getItem(CODE_PREVIEW_DOCK_STORAGE_KEY)).toBe(expected);
    }
  });

  it('routes setSize to height on vertical docks and width on horizontal (INV-5)', async () => {
    clearDockKeys();
    writeCodePreviewHeight(400);
    writeCodePreviewWidth(500);
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    expect(result.current.persistence.size).toBe(400);

    act(() => {
      result.current.layout.onCycleDock(); // bottom → right
    });
    expect(result.current.layout.dockPosition).toBe('right');
    expect(
      result.current.persistence.size,
      'INV-5: switching to a side dock must restore width, not copy the previous height'
    ).toBe(500);

    act(() => {
      result.current.setSize(360);
    });
    expect(localStorage.getItem(CODE_PREVIEW_WIDTH_STORAGE_KEY)).toBe('360');
    expect(
      localStorage.getItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY),
      'INV-4/5: horizontal resize must not rewrite the height key'
    ).toBe('400');

    // Advance one edge per act — onCycleDock closes over the current dockPosition.
    expect(result.current.layout.dockPosition).toBe('right');
    act(() => {
      result.current.layout.onCycleDock();
    });
    expect(result.current.layout.dockPosition).toBe('top');
    act(() => {
      result.current.layout.onCycleDock();
    });
    expect(result.current.layout.dockPosition).toBe('left');
    act(() => {
      result.current.layout.onCycleDock();
    });
    expect(result.current.layout.dockPosition).toBe('bottom');
    expect(
      result.current.persistence.size,
      'INV-5: returning to bottom restores the pre-side height, not the side width'
    ).toBe(400);
  });

  it('maximize uses the dock-axis viewport span; drag below clears it (INV-8)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    const bottomMax = dockAxisMaxSize(
      'bottom',
      resolveDockSheetLayout('bottom', window.innerWidth, window.innerHeight),
      window.innerWidth,
      window.innerHeight
    );
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.persistence.size).toBe(bottomMax);
    expect(result.current.persistence.maxSize).toBe(bottomMax);

    act(() => {
      result.current.layout.onCycleDock(); // → right, still maximized (INV-16)
    });
    expect(result.current.layout.maximized).toBe(true);
    const rightMax = dockAxisMaxSize(
      'right',
      resolveDockSheetLayout('right', window.innerWidth, window.innerHeight),
      window.innerWidth,
      window.innerHeight
    );
    expect(
      result.current.persistence.size,
      'INV-8/16: maximized size must track the new axis span, not the old height'
    ).toBe(rightMax);

    act(() => {
      result.current.setSize(Math.max(160, rightMax - 1));
    });
    expect(
      result.current.layout.maximized,
      'INV-8: a drag strictly below the axis max must clear maximize'
    ).toBe(false);
  });

  it('ignores kit size echoes of the stored size while maximized (left + bottom)', async () => {
    clearDockKeys();
    writeCodePreviewHeight(420);
    writeCodePreviewWidth(918);
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    // Bottom inset: maximize, then echo the stored height via onHeightChange.
    act(() => {
      result.current.layout.onToggleMaximize();
    });
    const bottomMax = dockAxisMaxSize(
      'bottom',
      resolveDockSheetLayout('bottom', window.innerWidth, window.innerHeight),
      window.innerWidth,
      window.innerHeight
    );
    expect(result.current.persistence.size).toBe(bottomMax);
    act(() => {
      result.current.setSize(420);
    });
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.persistence.size).toBe(bottomMax);
    expect(localStorage.getItem(CODE_PREVIEW_HEIGHT_STORAGE_KEY)).toBe('420');

    act(() => {
      result.current.layout.onToggleMaximize(); // restore
    });
    expect(result.current.persistence.size).toBe(420);

    // Left overlay: same echo must not collapse maximize to the 50% width.
    act(() => {
      result.current.layout.onDockPositionChange('left');
      result.current.layout.onToggleMaximize();
    });
    const leftMax = dockAxisMaxSize(
      'left',
      resolveDockSheetLayout('left', window.innerWidth, window.innerHeight),
      window.innerWidth,
      window.innerHeight
    );
    expect(leftMax).toBe(window.innerWidth - FORM_MIN_INLINE_PX);
    expect(result.current.persistence.size).toBe(leftMax);
    expect(result.current.persistence.maxSize).toBe(leftMax);
    act(() => {
      result.current.setSize(918);
    });
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.persistence.size).toBe(leftMax);
    expect(localStorage.getItem(CODE_PREVIEW_WIDTH_STORAGE_KEY)).toBe('918');

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    expect(result.current.layout.maximized).toBe(false);
    expect(result.current.persistence.size).toBe(918);
  });

  it('cycle while maximized stays maximized on the new axis (INV-16)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    for (const _ of DOCK_CYCLE_ORDER) {
      expect(result.current.layout.maximized).toBe(true);
      act(() => {
        result.current.layout.onCycleDock();
      });
    }
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.layout.dockPosition).toBe('bottom');
  });

  it('cycle while closed still persists; next open uses the new edge (INV-17)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.persistence.open).toBe(false);

    act(() => {
      result.current.layout.onCycleDock();
    });
    expect(result.current.persistence.open).toBe(false);
    expect(result.current.layout.dockPosition).toBe('right');
    expect(localStorage.getItem(CODE_PREVIEW_DOCK_STORAGE_KEY)).toBe('right');

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.persistence.open).toBe(true);
    expect(
      result.current.persistence.dockPosition,
      'INV-17: opening after a closed cycle must use the advanced edge'
    ).toBe('right');
  });

  it('keeps sheetId stable across dock cycles (INV-22)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    const sheetId = result.current.sheetId;
    expect(sheetId.length).toBeGreaterThan(0);

    act(() => {
      result.current.layout.onCycleDock();
      result.current.layout.onCycleDock();
    });
    expect(
      result.current.sheetId,
      'INV-22: dock cycle must not remount identity / clear latch via a new sheetId'
    ).toBe(sheetId);
  });

  it('does not change tree toggle semantics or storage key (INV-9)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    expect(result.current.layout.treeVisible).toBe(true);
    act(() => {
      result.current.layout.onToggleTree();
    });
    expect(result.current.layout.treeVisible).toBe(false);
    expect(localStorage.getItem(CODE_PREVIEW_TREE_STORAGE_KEY)).toBe('false');

    act(() => {
      result.current.layout.onCycleDock();
    });
    expect(
      result.current.layout.treeVisible,
      'INV-9: cycling dock must not rewrite tree visibility'
    ).toBe(false);
    expect(localStorage.getItem(CODE_PREVIEW_TREE_STORAGE_KEY)).toBe('false');
  });

  it('defaults missing width to ~50% of inline viewport on first side dock (INV-27)', async () => {
    clearDockKeys();
    // Height only — no width key.
    writeCodePreviewHeight(420);
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.layout.onCycleDock(); // → right
    });
    const expected = Math.round(window.innerWidth * 0.5);
    expect(
      result.current.persistence.size,
      `INV-27: first side dock without a width key should open near 50% of ${window.innerWidth}`
    ).toBe(expected);
  });

  it('nextDockPosition from current matches the control contract', () => {
    for (const side of DOCK_CYCLE_ORDER) {
      expect(nextDockPosition(side)).toBe(
        DOCK_CYCLE_ORDER[(DOCK_CYCLE_ORDER.indexOf(side) + 1) % 4]
      );
    }
  });

  it('persistence failures on dock write never throw (INV-6)', async () => {
    clearDockKeys();
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => {
      act(() => {
        result.current.layout.onCycleDock();
      });
    }).not.toThrow();
    expect(result.current.layout.dockPosition).toBe('right');
    spy.mockRestore();
  });

  it('waits for ready without flaking when dock keys are corrupt', async () => {
    localStorage.setItem(CODE_PREVIEW_DOCK_STORAGE_KEY, 'SIDE');
    localStorage.setItem(CODE_PREVIEW_WIDTH_STORAGE_KEY, 'not-a-number');
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);
    expect(result.current.layout.dockPosition).toBe('bottom');
    await waitFor(() => {
      expect(result.current.persistence.size).toBeGreaterThan(0);
    });
  });
});
