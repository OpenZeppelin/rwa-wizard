import { act, render, type RenderResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { coreCopy, formatCopy, type ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import { CopyContext } from '../../../app/providers/CopyContext';
import type { FieldProvenanceRow } from '../../../services/preview';
import { createdRow, fileRow, rangeRow } from '../../../test/helpers/impactHarness';
import type { RevealInPreview } from '../CodePreviewRevealContext';
import { revealTargetFor } from '../impact/revealTargetFor';
import { PreviewImpactRow } from './PreviewImpactRow';

const PATH = 'contracts/rwa-token/src/contract.rs';

interface RowHarness extends RenderResult {
  readonly button: HTMLButtonElement;
}

function mountRow(
  row: FieldProvenanceRow,
  options: {
    readonly onReveal?: RevealInPreview | null;
    readonly onActivate?: (() => void) | null;
    readonly secondary?: boolean;
    readonly active?: boolean;
    readonly copy?: ChainCopy;
    /** Non-null only while a refresh is in flight; `null` is the ordinary case. */
    readonly onDeferRange?: (() => void) | null;
  } = {}
): RowHarness {
  // Row activation is the column's `activateSite`. This harness mirrors that
  // path so existing INV-19 payload assertions stay meaningful against
  // `revealTargetFor` without re-implementing defer in the row.
  const onActivate =
    options.onActivate !== undefined
      ? options.onActivate
      : options.onReveal === null
        ? null
        : () => {
            const reveal = options.onReveal ?? vi.fn();
            if (options.onDeferRange != null && row.kind === 'range') {
              reveal({ path: PATH });
              options.onDeferRange();
              return;
            }
            reveal(revealTargetFor(PATH, row));
          };

  const result = render(
    <CopyContext.Provider value={options.copy ?? coreCopy}>
      <ul>
        <PreviewImpactRow
          path={PATH}
          row={row}
          secondary={options.secondary ?? false}
          onActivate={onActivate}
          active={options.active}
        />
      </ul>
    </CopyContext.Provider>
  );
  return { ...result, button: result.container.querySelector('button')! };
}

describe('PreviewImpactRow', () => {
  // -------------------------------------------------------------------------
  // INV-4 — the three kinds are the same kind of thing
  // -------------------------------------------------------------------------
  describe('gives the three row kinds equal standing (INV-4)', () => {
    const kinds: readonly (readonly [string, FieldProvenanceRow])[] = [
      ['range', rangeRow(12, 18)],
      ['file', fileRow()],
      ['created', createdRow()],
    ];

    for (const [label, row] of kinds) {
      it(`renders a ${label} row as a button in an li, with the same affordance`, () => {
        const harness = mountRow(row);
        expect(harness.button.tagName).toBe('BUTTON');
        expect(harness.button.getAttribute('type')).toBe('button');
        expect(harness.button.parentElement!.tagName).toBe('LI');
        expect(harness.button.disabled).toBe(false);
        expect(harness.button.hasAttribute('tabindex'), 'a row must not carry its own stop').toBe(
          false
        );
      });
    }

    it('gives all three kinds the same element shape, differing only in the label', () => {
      // "Equal standing" is a claim about the element, not about the words: same
      // tag, same type, same class list, same attribute set, same parent. Only
      // the label and what activation sends may differ (INV-19).
      const shapes = kinds.map(([, row]) => {
        const harness = mountRow(row);
        const button = harness.button;
        const shape = JSON.stringify({
          tag: button.tagName,
          parent: button.parentElement!.tagName,
          className: button.className,
          disabled: button.disabled,
          attributes: [...button.attributes].map((attribute) => attribute.name).sort(),
        });
        const label = button.textContent;
        harness.unmount();
        return { shape, label };
      });

      expect(
        new Set(shapes.map((entry) => entry.shape)).size,
        `the kinds render structurally different rows: ${shapes.map((entry) => entry.shape).join(' | ')}`
      ).toBe(1);
      expect(new Set(shapes.map((entry) => entry.label)).size).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // INV-19 — activation sends exactly one request, shaped by row.kind alone
  // -------------------------------------------------------------------------
  describe('requests reveal exactly once, with the range for ranged rows only (INV-19)', () => {
    it('a range row sends the generator-reported range, unmodified', () => {
      const onReveal = vi.fn();
      const harness = mountRow(rangeRow(41, 47), { onReveal });
      act(() => harness.button.click());
      expect(onReveal).toHaveBeenCalledTimes(1);
      expect(onReveal).toHaveBeenCalledWith({
        path: PATH,
        range: { startLine: 41, endLine: 47 },
      });
    });

    it('a file row sends no range key at all', () => {
      const onReveal = vi.fn();
      const harness = mountRow(fileRow(), { onReveal });
      act(() => harness.button.click());
      expect(onReveal).toHaveBeenCalledTimes(1);
      const target = onReveal.mock.calls[0]![0] as object;
      expect(target).toEqual({ path: PATH });
      // Asserted with `in`, not on the value: `range: undefined` would satisfy
      // an equality against `undefined` and would still make `'range' in target`
      // true for a consumer testing presence.
      expect('range' in target, 'a file row carried a range key').toBe(false);
    });

    it('a created row never synthesises a line jump', () => {
      // Telling the user the field created the file *at line 1* is a claim the
      // generator never made, and it is wrong for every file whose first line is
      // a licence header. AS-2.
      const onReveal = vi.fn();
      const harness = mountRow(createdRow(), { onReveal });
      act(() => harness.button.click());
      const target = onReveal.mock.calls[0]![0] as object;
      expect(target).toEqual({ path: PATH });
      expect('range' in target).toBe(false);
    });

    it('the same row activated twice sends two requests', () => {
      // `revealInPreview` bumps its retrigger token on every call (SF-9 INV-10),
      // so re-activating re-marks the range. The column must not de-duplicate,
      // guard on "already selected", or skip a call it judges redundant.
      const onReveal = vi.fn();
      const harness = mountRow(rangeRow(3, 4), { onReveal });
      act(() => harness.button.click());
      act(() => harness.button.click());
      expect(onReveal).toHaveBeenCalledTimes(2);
      expect(onReveal.mock.calls[0]).toEqual(onReveal.mock.calls[1]);
    });

    it('a single-line range still sends a range, not a whole-file target', () => {
      const onReveal = vi.fn();
      const harness = mountRow(rangeRow(20, 20), { onReveal });
      act(() => harness.button.click());
      expect(onReveal).toHaveBeenCalledWith({
        path: PATH,
        range: { startLine: 20, endLine: 20 },
      });
    });

    it('a secondary row sends exactly what its primary twin would', () => {
      // Secondary is presentation. The request is a function of `row.kind`, and
      // the demotion must not reach the payload.
      const primary = vi.fn();
      const secondary = vi.fn();
      const a = mountRow(rangeRow(41, 47), { onReveal: primary });
      act(() => a.button.click());
      a.unmount();
      const b = mountRow(rangeRow(41, 47, 'secondary'), { onReveal: secondary, secondary: true });
      act(() => b.button.click());
      expect(secondary.mock.calls).toEqual(primary.mock.calls);
    });

    it('has no key handler of its own — activation comes from the real button', () => {
      // Enter and Space activate a `<button>` for free in a browser; happy-dom
      // does not synthesise that click, so what is asserted here is the
      // *mechanism* that delivers it. `click()` is the activation event the
      // browser dispatches for both keys. The end-to-end keyboard route is
      // probe V9's, which lands on a row button by tabbing in from outside.
      const onReveal = vi.fn();
      const harness = mountRow(rangeRow(1, 2), { onReveal });
      expect(harness.button.onkeydown).toBeFalsy();
      expect(harness.button.onkeyup).toBeFalsy();
      expect(harness.button.onkeypress).toBeFalsy();
      act(() => harness.button.click());
      expect(onReveal).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-14 — onActivate === null disables activation without hiding the row
  // -------------------------------------------------------------------------
  describe('degrades to a disabled button when there is nothing to drive (INV-14)', () => {
    it('still renders the row, labelled, when onActivate is null', () => {
      const harness = mountRow(rangeRow(12, 18), { onReveal: null });
      expect(harness.button).toBeInTheDocument();
      expect(harness.button.textContent).toBe('Lines 12–18');
      expect(harness.button.disabled).toBe(true);
    });

    it('keeps the element shape identical to the enabled row apart from the disabled flag', () => {
      // A disabled button, not a missing one and not a `<span>`: the row count
      // and the DOM shape stay stable across the guard, which is what keeps the
      // three-region structure assertion honest.
      const enabled = mountRow(rangeRow(12, 18));
      const enabledHtml = enabled.button.outerHTML;
      enabled.unmount();
      const disabled = mountRow(rangeRow(12, 18), { onReveal: null });
      expect(disabled.button.outerHTML.replace(' disabled=""', '')).toBe(enabledHtml);
    });

    it('activating it calls nothing and throws nothing', () => {
      const harness = mountRow(fileRow(), { onReveal: null });
      expect(() => act(() => harness.button.click())).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // INV-38 — every visible string and every accessible name is copy
  // -------------------------------------------------------------------------
  describe('takes every string from the copy package (INV-38)', () => {
    function sentinelCopy(): ChainCopy {
      return {
        ...coreCopy,
        notice: (id: string) => ({ id: `notice.${id}`, description: `COPY::${id}` }),
      };
    }

    const labelCases: readonly (readonly [FieldProvenanceRow, string])[] = [
      [rangeRow(12, 18), 'code-preview.impact.row-range'],
      [rangeRow(20, 20), 'code-preview.impact.row-line'],
      [fileRow(), 'code-preview.impact.row-file'],
      [createdRow(), 'code-preview.impact.row-created'],
    ];

    for (const [row, id] of labelCases) {
      it(`takes the ${row.kind} row's visible label from ${id}`, () => {
        const harness = mountRow(row, { copy: sentinelCopy() });
        // A string the component wrote itself is visibly not one of these.
        expect(harness.button.textContent).toBe(`COPY::${id}`);
      });
    }

    it("takes the row's accessible name from the dictionary too", () => {
      // An accessible name is user-visible: it is simply the only copy some
      // users ever get, and it is what a screen reader announces for a row whose
      // whole content is "Lines 12-18".
      const harness = mountRow(rangeRow(12, 18), { copy: sentinelCopy() });
      expect(harness.button.getAttribute('aria-label')).toBe('COPY::code-preview.impact.row-label');
    });

    it('substitutes the placeholders through formatCopy against the real dictionary', () => {
      const harness = mountRow(rangeRow(12, 18));
      expect(harness.button.textContent).toBe('Lines 12–18');
      expect(harness.button.getAttribute('aria-label')).toBe(
        formatCopy(coreCopy.notice('code-preview.impact.row-label').description, {
          detail: 'Lines 12–18',
          path: PATH,
        })
      );
      expect(harness.button.getAttribute('aria-label')).toContain(PATH);
    });

    it('renders a single-line range through its own id, not a range with equal endpoints', () => {
      expect(mountRow(rangeRow(20, 20)).button.textContent).toBe('Line 20');
    });
  });

  it('publishes the range span for the probe without giving it any behaviour', () => {
    expect(mountRow(rangeRow(10, 43)).button.getAttribute('data-row-span')).toBe('34');
    expect(mountRow(fileRow()).button.getAttribute('data-row-span')).toBe('0');
  });

  // -------------------------------------------------------------------------
  // SF-21 INV-1 / INV-2 / INV-21 — active chrome is presentational
  // -------------------------------------------------------------------------
  describe('active chrome (SF-21 INV-1, INV-2, INV-21)', () => {
    it('active=true sets aria-current="true" and the selected class — INV-1 / INV-21', () => {
      const harness = mountRow(rangeRow(12, 18), { active: true });
      expect(harness.button.getAttribute('aria-current')).toBe('true');
      expect(harness.button.className).toContain('rwa-code-preview-impact-row-active');
    });

    it('active=false / omitted leaves aria-current absent — INV-21', () => {
      const omitted = mountRow(rangeRow(12, 18));
      expect(omitted.button.hasAttribute('aria-current')).toBe(false);
      expect(omitted.button.className).not.toContain('rwa-code-preview-impact-row-active');
      omitted.unmount();

      const explicit = mountRow(rangeRow(12, 18), { active: false });
      expect(explicit.button.hasAttribute('aria-current')).toBe(false);
      expect(explicit.button.getAttribute('aria-current')).not.toBe('false');
    });

    it('active does not change the reveal payload — INV-2', () => {
      const inactive = vi.fn();
      const active = vi.fn();
      const a = mountRow(rangeRow(41, 47), { onReveal: inactive, active: false });
      act(() => a.button.click());
      a.unmount();
      const b = mountRow(rangeRow(41, 47), { onReveal: active, active: true });
      act(() => b.button.click());
      expect(active.mock.calls).toEqual(inactive.mock.calls);
    });

    it('Enter/Space mechanism still works with active true — INV-23', () => {
      // Same mechanism claim as SF-13: real <button>, no key handler of our own.
      const onActivate = vi.fn();
      const harness = mountRow(rangeRow(1, 2), { onActivate, active: true });
      expect(harness.button.onkeydown).toBeFalsy();
      act(() => harness.button.click());
      expect(onActivate).toHaveBeenCalledTimes(1);
    });
  });
});
