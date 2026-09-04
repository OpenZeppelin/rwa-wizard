/**
 * SF-17 — TogglePill three-affordance contract (INV-1–7, INV-12, INV-17, INV-22–23).
 *
 * Mounts under a real InspectedAnchorProvider + CopyProvider so inspected state
 * and accessible names are the production path, not stubs.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';

import { CopyProvider } from '../../app/providers/CopyProvider';
import { claimTopicAnchor } from '../../features/wizard/focused-path';
import { STELLAR_TARGET_ID } from '../../test/helpers/focusedPathHarness';
import { mountProvider } from '../../test/helpers/inspectedAnchorHarness';
import { findToken, readScannedSources } from '../../test/helpers/sourceScan';
import { TogglePill } from './TogglePill';

const ANCHOR = claimTopicAnchor(1);

function wrap(node: ReactElement) {
  return <CopyProvider targetId={STELLAR_TARGET_ID}>{node}</CopyProvider>;
}

function mountThreeAffordance(
  props: Partial<ComponentProps<typeof TogglePill>> & {
    selected: boolean;
    onToggleSelection: () => void;
  }
) {
  return mountProvider({
    candidates: [ANCHOR],
    children: wrap(
      <TogglePill
        label="KYC"
        detail={1}
        configAnchor={ANCHOR}
        onRemove={props.onRemove}
        {...props}
      />
    ),
  });
}

function selectionButton(container: HTMLElement): HTMLButtonElement {
  const pressed = container.querySelector<HTMLButtonElement>('button[aria-pressed]');
  if (pressed === null) {
    throw new Error('INV-3 violated: three-affordance chip rendered no selection control');
  }
  return pressed;
}

function bodyButton(container: HTMLElement): HTMLButtonElement {
  const wrapper = container.querySelector(`[data-config-anchor="${ANCHOR}"]`)!;
  const buttons = [...wrapper.querySelectorAll<HTMLButtonElement>('button')];
  // Body is first; selection has aria-pressed; remove has aria-label^="Remove ".
  const body = buttons.find(
    (button) =>
      !button.hasAttribute('aria-pressed') &&
      !button.getAttribute('aria-label')?.startsWith('Remove ')
  );
  if (body === undefined) throw new Error('INV-2 violated: no body button');
  return body;
}

describe('SF-17 TogglePill — Render Contract', () => {
  // -------------------------------------------------------------------------
  // INV-1 — inspected is useIsInspected alone (never && selected)
  // -------------------------------------------------------------------------
  describe('INV-1 — inspected state is not gated on selected', () => {
    it('an inspected-unselected chip keeps aria-current and the offset ring', () => {
      const harness = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });

      act(() => {
        bodyButton(harness.container).focus();
      });

      const wrapper = harness.container.querySelector(`[data-config-anchor="${ANCHOR}"]`)!;
      expect(
        wrapper.getAttribute('aria-current'),
        'INV-1: inspected-unselected must carry aria-current="true" (AS-4)'
      ).toBe('true');
      expect(wrapper.className).toContain('ring-1');
      expect(wrapper.className).toContain('ring-offset-1');
      expect(wrapper.className).toContain('border-dashed');
    });

    it('the inspected derivation does not contain && selected (regression scan)', () => {
      const [source] = readScannedSources(['src/components/shared/TogglePill.tsx']);
      // Narrow to the inspected assignment — pure-toggle still uses `&& selected`
      // for the decorative Check inside the body (INV-3), which must not trip this.
      const inspectedLine = source!.stripped
        .split('\n')
        .map((line, offset) => ({ line, number: offset + 1 }))
        .find((entry) => /const inspected\s*=/.test(entry.line));
      expect(inspectedLine, 'INV-1: inspected derivation missing').toBeDefined();
      expect(
        inspectedLine!.line,
        'INV-1: restoring `useIsInspected(...) && selected` hides inspected-unselected'
      ).not.toMatch(/&&\s*selected/);
      expect(inspectedLine!.line).toMatch(/useIsInspected\(configAnchor\)/);
      // Positive control — the comment that forbids restoration must still exist.
      expect(source!.raw).toMatch(/Restoring the conjunction/);
    });
  });

  // -------------------------------------------------------------------------
  // INV-2 — body stays a <button>
  // -------------------------------------------------------------------------
  describe('INV-2 — body is always a <button type="button">', () => {
    it('three-affordance mode (no onClick) still renders a tab-order body button', () => {
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      const body = bodyButton(harness.container);
      expect(body.localName).toBe('button');
      expect(body.getAttribute('type')).toBe('button');
      expect(body.tabIndex).toBeGreaterThanOrEqual(0);
    });

    it('pure-toggle mode keeps the same body button contract', () => {
      const { container } = render(
        wrap(<TogglePill label="KYC" selected onClick={() => {}} configAnchor={ANCHOR} />)
      );
      const body = container.querySelector('button')!;
      expect(body.getAttribute('type')).toBe('button');
      expect(body.querySelector('.lucide-check')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // INV-3 — selection control always present in three-affordance
  // -------------------------------------------------------------------------
  describe('INV-3 — three-affordance always renders a selection control', () => {
    it('unselected → Circle + aria-pressed="false"', () => {
      const harness = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });
      const control = selectionButton(harness.container);
      expect(control.getAttribute('aria-pressed')).toBe('false');
      expect(control.querySelector('.lucide-circle')).not.toBeNull();
      expect(control.querySelector('.lucide-check')).toBeNull();
    });

    it('selected → Check + aria-pressed="true"', () => {
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      const control = selectionButton(harness.container);
      expect(control.getAttribute('aria-pressed')).toBe('true');
      expect(control.querySelector('.lucide-check')).not.toBeNull();
    });

    it('pure-toggle selected has no dedicated selection button; decorative Check is in the body', () => {
      const { container } = render(wrap(<TogglePill label="AML" selected onClick={() => {}} />));
      expect(container.querySelector('button[aria-pressed]')).toBeNull();
      const body = container.querySelector('button')!;
      expect(body.querySelector('.lucide-check')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // INV-4 — selection via fill/border; inspection via ring; no selection ring
  // -------------------------------------------------------------------------
  describe('INV-4 — selection and inspection use distinct visual vocabularies', () => {
    it('selected uses primary fill/border; unselected uses dashed border', () => {
      const selected = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      const unselected = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });
      const selectedClass = selected.container.querySelector(
        `[data-config-anchor="${ANCHOR}"]`
      )!.className;
      const unselectedClass = unselected.container.querySelector(
        `[data-config-anchor="${ANCHOR}"]`
      )!.className;

      expect(selectedClass).toContain('border-primary');
      expect(selectedClass).toContain('bg-primary/10');
      expect(unselectedClass).toContain('border-dashed');
      expect(unselectedClass).toContain('text-muted-foreground');
    });

    it('selected && !inspected carries no ring-* class (no selection ring)', () => {
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      // Do not focus/click — leave uninspected.
      const className = harness.container.querySelector(
        `[data-config-anchor="${ANCHOR}"]`
      )!.className;
      expect(className).not.toMatch(/\bring-/);
    });

    it('inspected-unselected shows dashed border AND offset ring together (AS-4 + AS-5)', () => {
      const harness = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });
      act(() => {
        bodyButton(harness.container).focus();
      });
      const className = harness.container.querySelector(
        `[data-config-anchor="${ANCHOR}"]`
      )!.className;
      expect(className).toContain('border-dashed');
      expect(className).toContain('ring-1');
      expect(className).toContain('ring-offset-1');
    });
  });

  // -------------------------------------------------------------------------
  // INV-5 / INV-6 — × iff onRemove; aria-current on wrapper only
  // -------------------------------------------------------------------------
  describe('INV-5 / INV-6 — remove control and aria-current carrier', () => {
    it('× renders iff onRemove is provided', () => {
      const withRemove = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
        onRemove: () => {},
      });
      const without = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      expect(withRemove.container.querySelector('button[aria-label^="Remove "]')).not.toBeNull();
      expect(without.container.querySelector('button[aria-label^="Remove "]')).toBeNull();
    });

    it('inspected chip has exactly one aria-current="true", on the anchored wrapper', () => {
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
        onRemove: () => {},
      });
      act(() => {
        bodyButton(harness.container).focus();
      });
      const currents = [...harness.container.querySelectorAll('[aria-current="true"]')];
      expect(currents).toHaveLength(1);
      expect(currents[0]!.getAttribute('data-config-anchor')).toBe(ANCHOR);
      for (const button of harness.container.querySelectorAll('button')) {
        expect(button.hasAttribute('aria-current')).toBe(false);
      }
    });
  });
});

describe('SF-17 TogglePill — Prop / Interaction / A11y', () => {
  // -------------------------------------------------------------------------
  // INV-7 — modes mutually exclusive
  // -------------------------------------------------------------------------
  describe('INV-7 — never both onClick and onToggleSelection', () => {
    it('throws when both callbacks are passed', () => {
      expect(() =>
        render(
          wrap(<TogglePill label="KYC" selected onClick={() => {}} onToggleSelection={() => {}} />)
        )
      ).toThrow(/onClick or onToggleSelection, not both/);
    });
  });

  // -------------------------------------------------------------------------
  // INV-12 — body activation does not change selection
  // -------------------------------------------------------------------------
  describe('INV-12 — body inspects and does not toggle selection', () => {
    it('clicking the body does not call onToggleSelection', () => {
      const onToggleSelection = vi.fn();
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection,
      });
      fireEvent.click(bodyButton(harness.container));
      expect(
        onToggleSelection,
        'INV-12 / AS-1: body click must not mutate deploy selection'
      ).not.toHaveBeenCalled();
    });

    it('keyboard activation of the body likewise leaves selection alone', () => {
      const onToggleSelection = vi.fn();
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection,
      });
      const body = bodyButton(harness.container);
      act(() => {
        body.focus();
      });
      fireEvent.keyDown(body, { key: 'Enter' });
      fireEvent.keyUp(body, { key: 'Enter' });
      // Native button activation synthesises click; if the body had a handler it
      // would fire. With no onClick, selection must stay untouched.
      expect(onToggleSelection).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // INV-13 / INV-17 — selection control toggles once; no stopPropagation
  // -------------------------------------------------------------------------
  describe('INV-13 / INV-17 — selection control', () => {
    it('activating the selection control fires onToggleSelection exactly once', () => {
      const onToggleSelection = vi.fn();
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection,
      });
      fireEvent.click(selectionButton(harness.container));
      expect(onToggleSelection).toHaveBeenCalledTimes(1);
    });

    it('selection handler does not call stopPropagation (bubble-phase inspection)', () => {
      const [source] = readScannedSources(['src/components/shared/TogglePill.tsx']);
      expect(
        findToken(source!, 'stopPropagation'),
        'INV-17 revised: stopPropagation would hide checkmark presses from the bubble-phase SF-14 listener'
      ).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-22 / INV-23 — copy-owned names; keyboard-operable selection button
  // -------------------------------------------------------------------------
  describe('INV-22 / INV-23 — accessible selection and remove controls', () => {
    it('selection button names are Select/Deselect via copy, not hard-coded', () => {
      const selected = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
      });
      const unselected = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });
      expect(selectionButton(selected.container).getAttribute('aria-label')).toBe('Deselect KYC');
      expect(selectionButton(unselected.container).getAttribute('aria-label')).toBe('Select KYC');
    });

    it('remove button name is copy-owned Remove {label}', () => {
      const harness = mountThreeAffordance({
        selected: true,
        onToggleSelection: () => {},
        onRemove: () => {},
      });
      expect(harness.container.querySelector('button[aria-label="Remove KYC"]')).not.toBeNull();
    });

    it('TogglePill source has no hard-coded Select/Deselect/Remove string literals', () => {
      const [source] = readScannedSources(['src/components/shared/TogglePill.tsx']);
      expect(findToken(source!, 'Select ')).toEqual([]);
      expect(findToken(source!, 'Deselect ')).toEqual([]);
      expect(findToken(source!, 'Remove ${')).toEqual([]);
      expect(findToken(source!, '`Remove ')).toEqual([]);
    });

    it('disabled chip disables the selection button', () => {
      const harness = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
        disabled: true,
      });
      expect(selectionButton(harness.container).disabled).toBe(true);
    });

    it('selection button is a real tab-order <button>', () => {
      const harness = mountThreeAffordance({
        selected: false,
        onToggleSelection: () => {},
      });
      const control = selectionButton(harness.container);
      expect(control.localName).toBe('button');
      expect(control.getAttribute('type')).toBe('button');
      expect(control.disabled).toBe(false);
      expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });
});
