import { describe, expect, it } from 'vitest';

import {
  DOCK_CYCLE_ORDER,
  isHorizontalDock,
  isVerticalDock,
  nextDockPosition,
  parseDockPosition,
  resolveDockMenuSelection,
  WIZARD_DOCK_MENU_POSITIONS,
  type CodePreviewDockPosition,
} from './dockPosition';

/**
 * SF-23 INV-1 / INV-2 / INV-3 — pure dock-edge helpers.
 * Geometry is probe-owned (INV-24); these tests assert the controllable contract only.
 */

describe('parseDockPosition (INV-1, INV-2)', () => {
  it.each(DOCK_CYCLE_ORDER)('round-trips the closed literal %s', (side) => {
    expect(parseDockPosition(side)).toBe(side);
  });

  it.each([
    null,
    '',
    'side',
    'BOTTOM',
    'Bottom',
    'north',
    'top ',
    ' top',
    '0',
    'undefined',
    'null',
    '[{"side":"left"}]',
  ])('maps garbage %j to bottom without throwing', (raw) => {
    expect(() => parseDockPosition(raw)).not.toThrow();
    expect(
      parseDockPosition(raw),
      `INV-2: corrupt ingress ${JSON.stringify(raw)} must yield the closed default, not throw or open-string`
    ).toBe('bottom');
  });

  it('never returns a value outside the closed union', () => {
    const samples: Array<string | null> = [
      null,
      '',
      'bottom',
      'right',
      'top',
      'left',
      'BOTTOM',
      'floating',
      'detach',
    ];
    const allowed = new Set<string>(DOCK_CYCLE_ORDER);
    for (const raw of samples) {
      const parsed = parseDockPosition(raw);
      expect(
        allowed.has(parsed),
        `INV-1: parseDockPosition(${JSON.stringify(raw)}) returned ${parsed}, outside the closed union`
      ).toBe(true);
    }
  });
});

describe('nextDockPosition (INV-3)', () => {
  it('is exactly the documented 4-cycle starting at bottom', () => {
    expect([...DOCK_CYCLE_ORDER]).toEqual(['bottom', 'right', 'top', 'left']);
  });

  it.each(DOCK_CYCLE_ORDER)('four applications from %s return to the start (orbit)', (start) => {
    let current: CodePreviewDockPosition = start;
    const orbit: CodePreviewDockPosition[] = [start];
    for (let i = 0; i < 4; i += 1) {
      current = nextDockPosition(current);
      orbit.push(current);
    }
    expect(
      current,
      `INV-3: four nextDockPosition steps from ${start} must return to ${start}; orbit=${orbit.join('→')}`
    ).toBe(start);
  });

  it('visits every edge exactly once per full cycle from bottom', () => {
    const visited: CodePreviewDockPosition[] = [];
    let current: CodePreviewDockPosition = 'bottom';
    for (let i = 0; i < 4; i += 1) {
      current = nextDockPosition(current);
      visited.push(current);
    }
    expect(visited).toEqual(['right', 'top', 'left', 'bottom']);
    expect(new Set(visited).size).toBe(4);
  });
});

describe('axis helpers', () => {
  it('classifies vertical vs horizontal docks', () => {
    expect(isVerticalDock('top')).toBe(true);
    expect(isVerticalDock('bottom')).toBe(true);
    expect(isVerticalDock('left')).toBe(false);
    expect(isHorizontalDock('left')).toBe(true);
    expect(isHorizontalDock('right')).toBe(true);
    expect(isHorizontalDock('bottom')).toBe(false);
  });
});

describe('resolveDockMenuSelection', () => {
  it('keeps the current dock when it is offered', () => {
    expect(resolveDockMenuSelection('left', WIZARD_DOCK_MENU_POSITIONS)).toBe('left');
    expect(resolveDockMenuSelection('bottom', WIZARD_DOCK_MENU_POSITIONS)).toBe('bottom');
  });

  it('defaults legacy top/right to bottom for the wizard menu', () => {
    expect(resolveDockMenuSelection('top', WIZARD_DOCK_MENU_POSITIONS)).toBe('bottom');
    expect(resolveDockMenuSelection('right', WIZARD_DOCK_MENU_POSITIONS)).toBe('bottom');
  });

  it('falls back to the first offered edge when bottom is not listed', () => {
    expect(resolveDockMenuSelection('top', ['left', 'right'])).toBe('left');
  });

  it('leaves current unchanged for an empty menu', () => {
    expect(resolveDockMenuSelection('right', [])).toBe('right');
  });
});
