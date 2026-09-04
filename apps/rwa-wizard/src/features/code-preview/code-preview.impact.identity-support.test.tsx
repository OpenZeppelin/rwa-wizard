import { act, render, type RenderResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { coreCopy } from '@openzeppelin/rwa-wizard-copy';

import { PreviewImpactColumn } from './components/PreviewImpactColumn';

import { collectFocusable, fixtureDraft, renderStep } from '../../test/helpers/focusedPathHarness';
import { availableProvenance, group, rangeRow } from '../../test/helpers/impactHarness';
import { CONFIG_ANCHOR_ATTR, resolveFocusedConfigPath, tokenAnchor } from '../wizard/focused-path';
import type { CodePreviewProvenance } from './provenanceState';

/**
 * INV-37, driven through the real control rather than a fixture.
 *
 * `include-identity-support` is the one control in the wizard with this shape: a
 * **generation option** that is threaded to `generateFileTree` / `generateZip`
 * and is part of `useCodePreview`'s cache key — so it demonstrably changes the
 * generated tree — and that still, correctly, resolves to no `ConfigPath`,
 * because `ConfigPath` spans `RWAConfig` and generation options are not in it.
 *
 * A fixture would assert that a hand-written `null` produces `not-a-field`,
 * which is the tautology. The value is in proving the **real** control still
 * lands there after either side changes, because the day it stops, a user
 * toggles identity support, watches the file tree visibly change, and reads a
 * sentence telling them it changed nothing.
 */

const DRAFT = fixtureDraft();

function mountColumn(provenance: CodePreviewProvenance | null): RenderResult {
  return render(
    <div>
      <input data-testid="field-a" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
      <PreviewImpactColumn
        config={DRAFT}
        provenance={provenance}
        onReveal={vi.fn()}
        drawerOpen={false}
      />
    </div>
  );
}

function focus(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

const NOT_A_FIELD = coreCopy.notice('code-preview.impact.not-a-field');
const EMPTY = coreCopy.notice('code-preview.impact.empty');

describe('the identity-support control lands in not-a-field, never in empty (INV-37)', () => {
  it('renders the real control on the real Review step', () => {
    // The precondition, asserted rather than assumed: `networkIsTestnet` must be
    // true and `supportsIdentitySupport` must be passed, or the control never
    // renders and every assertion below is about a control that is not there.
    const step = renderStep('review', DRAFT);
    expect(step.container.querySelector('#include-identity-support')).not.toBeNull();
  });

  it("SF-12's real resolver answers null for it, while it is a real focus target", () => {
    const step = renderStep('review', DRAFT);
    const control = step.container.querySelector<HTMLElement>('#include-identity-support')!;
    expect(resolveFocusedConfigPath(control, DRAFT)).toBeNull();
  });

  it('shows not-a-field, not empty, while the control has focus', () => {
    const step = renderStep('review', DRAFT);
    const control = step.container.querySelector<HTMLElement>('#include-identity-support')!;
    const column = mountColumn(availableProvenance([group('a.rs', [rangeRow(1, 2)])]).provenance);

    focus(control);

    expect(column.getByText(NOT_A_FIELD.title!)).toBeInTheDocument();
    expect(column.getByText(NOT_A_FIELD.description)).toBeInTheDocument();
    expect(column.queryByText(EMPTY.title!)).toBeNull();
    expect(column.queryByText(EMPTY.description)).toBeNull();
  });

  it('lands there for a control with no effect on the tree as well', () => {
    // The state has to be true for both ends of the range it covers: a control
    // that changes nothing, and a control that changes a great deal. That is why
    // its copy speaks about the control and about attribution, and never about
    // effect.
    const step = renderStep('review', DRAFT);
    const others = collectFocusable(step.container).filter(
      (element) => element.id !== 'include-identity-support'
    );
    expect(others.length, 'the review step rendered nothing else focusable').toBeGreaterThan(0);

    const inert = others.find((element) => resolveFocusedConfigPath(element, DRAFT) === null);
    expect(inert, 'no unresolvable control to contrast with').toBeDefined();

    const column = mountColumn(availableProvenance([group('a.rs', [rangeRow(1, 2)])]).provenance);
    focus(inert!);
    expect(column.getByText(NOT_A_FIELD.title!)).toBeInTheDocument();
  });

  it('reaches empty only through a field that genuinely resolved to a ConfigPath', () => {
    const column = mountColumn(availableProvenance([]).provenance);
    focus(column.getByTestId('field-a'));
    expect(column.getByText(EMPTY.title!)).toBeInTheDocument();
    expect(column.queryByText(NOT_A_FIELD.title!)).toBeNull();
  });

  it('keeps the two claims non-overlapping in the dictionary', () => {
    // `empty` is the only state permitted to make a claim about the generated
    // code. If `not-a-field` is ever reworded to the more natural "this field
    // doesn't affect any generated code", it becomes false for the one control
    // in the wizard that changes the tree without being attributable.
    expect(NOT_A_FIELD.description).not.toBe(EMPTY.description);
    expect(NOT_A_FIELD.title).not.toBe(EMPTY.title);

    // The line is between a claim about **attribution** and a claim about
    // **effect**. `not-a-field` may say the generator does not attribute code to
    // this control — true for the Next button and true for identity support. It
    // may not say the control has no effect, because identity support plainly
    // does.
    const EFFECT_CLAIM = /(affects?\s+no|does(n't|\s+not)\s+affect|no generated \w+ depends)/i;

    expect(
      EFFECT_CLAIM.test(NOT_A_FIELD.description),
      `not-a-field claims the control has no effect, which is false for include-identity-support: "${NOT_A_FIELD.description}"`
    ).toBe(false);
    expect(
      /attribut/i.test(NOT_A_FIELD.description),
      'not-a-field stopped speaking about attribution, which is the only true thing it can say'
    ).toBe(true);
    expect(
      EFFECT_CLAIM.test(EMPTY.description),
      'empty stopped being the one state that makes a claim about the generated code'
    ).toBe(true);
  });

  it('merges neither into the other — they are two distinct view kinds', () => {
    const step = renderStep('review', DRAFT);
    const control = step.container.querySelector<HTMLElement>('#include-identity-support')!;
    const column = mountColumn(availableProvenance([]).provenance);

    focus(column.getByTestId('field-a'));
    const emptyText = column.container.querySelector(
      '.rwa-code-preview-impact-scroll'
    )!.textContent;

    focus(control);
    const notAFieldText = column.container.querySelector(
      '.rwa-code-preview-impact-scroll'
    )!.textContent;

    expect(emptyText).not.toBe(notAFieldText);
    expect(notAFieldText).not.toContain(EMPTY.description);
  });
});
