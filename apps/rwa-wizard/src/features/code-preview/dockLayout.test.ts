import { describe, expect, it } from 'vitest';

import {
  dockAxisMaxSize,
  FORM_MIN_INLINE_PX,
  resolveDockSheetLayout,
  SIDE_INSET_MIN_VIEWPORT_PX,
  TOP_FORM_MIN_BLOCK_PX,
  TOP_OVERLAY_BELOW_VIEWPORT_PX,
} from './dockLayout';
import { DOCK_CYCLE_ORDER } from './dockPosition';

/**
 * Product: bottom inset; left/right/top overlay. Clamp helpers still honour an
 * explicit inset layout argument. Never asserts placement geometry (INV-24).
 */

describe('resolveDockSheetLayout (bottom inset, side overlay)', () => {
  it('returns inset for bottom at every viewport size', () => {
    expect(resolveDockSheetLayout('bottom', 1280, 900)).toBe('inset');
    expect(resolveDockSheetLayout('bottom', 400, 200)).toBe('inset');
  });

  it('returns overlay for left, right, and top', () => {
    expect(resolveDockSheetLayout('left', 1280, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('right', 1280, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('top', 1280, 900)).toBe('overlay');
  });

  it('returns overlay below legacy narrow / short thresholds on side docks', () => {
    expect(resolveDockSheetLayout('left', SIDE_INSET_MIN_VIEWPORT_PX - 1, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('right', 400, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('top', 1280, TOP_OVERLAY_BELOW_VIEWPORT_PX - 1)).toBe('overlay');
  });

  it('returns overlay at or above legacy inset thresholds on side docks', () => {
    expect(resolveDockSheetLayout('left', SIDE_INSET_MIN_VIEWPORT_PX, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('right', 1280, 900)).toBe('overlay');
    expect(resolveDockSheetLayout('top', 1280, TOP_OVERLAY_BELOW_VIEWPORT_PX)).toBe('overlay');
  });

  it('never rewrites dock position — only returns layout', () => {
    for (const side of DOCK_CYCLE_ORDER) {
      const layout = resolveDockSheetLayout(side, 400, 280);
      expect(layout).toBe(side === 'bottom' ? 'inset' : 'overlay');
      expect(side).toBe(side);
    }
  });
});

describe('dockAxisMaxSize (INV-8, INV-11, INV-26)', () => {
  it('reserves form inline space on horizontal inset docks', () => {
    const max = dockAxisMaxSize('right', 'inset', 1280, 900);
    expect(max).toBe(1280 - FORM_MIN_INLINE_PX);
    expect(max).toBeGreaterThanOrEqual(160);
  });

  it('reserves form inline space on horizontal overlay maximize (does not bury the form)', () => {
    expect(dockAxisMaxSize('left', 'overlay', 400, 900)).toBe(400 - FORM_MIN_INLINE_PX);
    expect(dockAxisMaxSize('right', 'overlay', 1280, 900)).toBe(1280 - FORM_MIN_INLINE_PX);
  });

  it('leaves a form band on top inset when tall enough', () => {
    const vh = 900;
    expect(dockAxisMaxSize('top', 'inset', 1280, vh)).toBe(vh - TOP_FORM_MIN_BLOCK_PX);
  });

  it('leaves a form band on top overlay when tall enough', () => {
    const vh = 900;
    expect(dockAxisMaxSize('top', 'overlay', 1280, vh)).toBe(vh - TOP_FORM_MIN_BLOCK_PX);
  });

  it('uses full viewport height for bottom overlay', () => {
    expect(dockAxisMaxSize('bottom', 'overlay', 1280, 900)).toBe(900);
  });

  it('uses full viewport height for bottom inset maximize (explicit takeover)', () => {
    const vh = 900;
    expect(dockAxisMaxSize('bottom', 'inset', 1280, vh)).toBe(vh);
  });

  it('uses full viewport height for top overlay below the short-viewport threshold', () => {
    expect(dockAxisMaxSize('top', 'overlay', 1280, TOP_OVERLAY_BELOW_VIEWPORT_PX - 1)).toBe(
      TOP_OVERLAY_BELOW_VIEWPORT_PX - 1
    );
  });

  it('never returns a negative axis max', () => {
    expect(dockAxisMaxSize('right', 'inset', FORM_MIN_INLINE_PX - 10, 900)).toBe(0);
    expect(dockAxisMaxSize('left', 'overlay', FORM_MIN_INLINE_PX - 10, 900)).toBe(0);
  });
});
