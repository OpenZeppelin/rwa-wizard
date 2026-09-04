import { describe, expect, it } from 'vitest';

import { readScannedSources, type ScannedSource } from '../../test/helpers/sourceScan';

/**
 * SF-14 INV-13's **counterweight**, and it is required rather than optional.
 *
 * `useIsInspected`, `useInspectedConfigPath` and `useInspectAnchor` all degrade
 * to inert outside the provider, deliberately: `anchoredComponents.test.tsx`,
 * `renderStep` and the 25-file markup guard render these components with no
 * provider, and a throwing hook would take all three down.
 *
 * The price of that choice is a real silent-failure mode — **forget the provider
 * in `WizardPage` and the whole feature ships inert with a fully green suite.**
 * Nothing behavioural can catch it, because every behavioural test mounts its own
 * provider. This file is the only thing standing between that and a release, so
 * it asserts the mount **structurally**: the provider's element must open before
 * and close after both subtrees it has to span — the writers in `WizardLayout`
 * and the reader in `CodePreviewDrawer`.
 *
 * A source assertion and not a render, on purpose. Rendering `WizardPage`
 * requires a router, draft storage, adapter capabilities and a codegen service;
 * a test that mounted all four would fail for four reasons that are not this one,
 * and would be the first thing skipped when one of them changed.
 */

const PAGE = 'src/features/wizard/WizardPage.tsx';

const [page] = readScannedSources([PAGE]) as readonly [ScannedSource];

/** First index of `needle` in the comment-stripped source, or a failing -1. */
function at(needle: string): number {
  return page.stripped.indexOf(needle);
}

describe('WizardPage mounts the inspected-anchor provider (INV-13)', () => {
  it('the scan read the page', () => {
    expect(page.path).toBe(PAGE);
    expect(page.stripped).toContain('export function WizardPage');
    expect(page.raw.length).toBeGreaterThan(1000);
  });

  it('imports the provider from the curated surface', () => {
    expect(page.stripped).toContain("from './inspected-anchor'");
    expect(page.stripped).toContain('InspectedAnchorProvider');
  });

  /**
   * The two subtrees, by name. `WizardLayout` holds every writer — the chips, the
   * issuer rows, the two add handlers — and `CodePreviewDrawer` holds the only
   * reader. They are **siblings**, which is the whole reason the subject lives in
   * a store rather than in React state: state high enough to serve both would
   * re-render the entire form on every subject change.
   */
  it('opens before, and closes after, both `WizardLayout` and `CodePreviewDrawer`', () => {
    const open = at('<InspectedAnchorProvider');
    const close = at('</InspectedAnchorProvider>');
    const layout = at('<WizardLayout');
    const drawer = at('<CodePreviewDrawer');

    for (const [name, index] of [
      ['<InspectedAnchorProvider', open],
      ['</InspectedAnchorProvider>', close],
      ['<WizardLayout', layout],
      ['<CodePreviewDrawer', drawer],
    ] as const) {
      expect(index, `${name} is not present in ${PAGE}`).toBeGreaterThan(-1);
    }

    expect(open, 'the provider opens after WizardLayout').toBeLessThan(layout);
    expect(open, 'the provider opens after CodePreviewDrawer').toBeLessThan(drawer);
    expect(close, 'the provider closes before WizardLayout').toBeGreaterThan(layout);
    expect(close, 'the provider closes before CodePreviewDrawer').toBeGreaterThan(drawer);
  });

  it('is mounted exactly once', () => {
    expect(page.stripped.match(/<InspectedAnchorProvider/g) ?? []).toHaveLength(1);
    expect(page.stripped.match(/<\/InspectedAnchorProvider>/g) ?? []).toHaveLength(1);
  });

  /**
   * The scope token, by value. Without the **step** half the user could inspect a
   * claim topic, navigate to Compliance, and leave the column describing an item
   * that is nowhere on screen with the marker attached to nothing — and Research
   * answered this as falling out of the existence check, which it does not: a
   * claim topic still exists in the draft while the user is on another step, only
   * its DOM is gone. INV-23.
   */
  it('passes the three-part scope token, including the step', () => {
    expect(page.stripped).toContain(
      "scopeToken={`${resetKey}-${activeDraftId ?? 'none'}-${currentStep}`}"
    );
  });

  /**
   * The `modules` prop, by value. Without it a click on a scalar module-config
   * field falls through to the enclosing panel's `module|<id>` and the column
   * describes the *module* rather than the field being typed in — coarser than
   * today's answer. It is the resolver's own second parameter, and the narrowest
   * slice that closes the gap.
   */
  it('passes the selected compliance modules to the key walk', () => {
    expect(page.stripped).toMatch(/modules=\{[^}]*compliance\.modules[^}]*\}/);
  });

  it('offers only bottom + left in the code-preview dock menu', () => {
    expect(page.stripped).toContain('WIZARD_DOCK_MENU_POSITIONS');
    expect(page.stripped).toContain('dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS');
    expect(page.stripped).not.toContain('ALL_DOCK_MENU_POSITIONS');
    expect(page.stripped).not.toContain('onCycleDock');
  });
});
