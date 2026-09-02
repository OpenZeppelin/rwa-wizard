import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { APP_ROOT, REPO_ROOT, stripComments } from '../../test/helpers/sourceScan';

/**
 * SF-20 / SC-017 — opaque tree/code join.
 *
 * Low stakes: no formal INV-N document. These are the contracts the Code Draft
 * marked for Tests that happy-dom *can* see — stylesheet shape, wrapper class
 * names, separator placement (pane not tree), and AS-2 (chip ring untouched).
 * Paint under sticky scroll is layout-probe V11.
 */

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), 'utf8');
}

const CSS_PATH = 'src/features/code-preview/code-preview.css';
const PANE_PATH = 'src/features/code-preview/components/PreviewCodePane.tsx';
const BODY_PATH = 'src/features/code-preview/components/PreviewDrawerBody.tsx';
const PILL_PATH = 'src/components/shared/TogglePill.tsx';

const SF20_SURFACES = [CSS_PATH, PANE_PATH, BODY_PATH] as const;

const CHIP_RING_TOKENS = [
  'ring-1',
  'ring-primary',
  'ring-offset-1',
  'ring-offset-background',
] as const;

describe('opaque tree/code join CSS contract (SC-017)', () => {
  const css = stripComments(readApp(CSS_PATH));

  it('paints the kit gutter with the editor ground token — not inherit (happy path)', () => {
    const ruleStart = css.indexOf('.rwa-code-preview-code [data-code-view-gutter]');
    expect(
      ruleStart,
      'missing [data-code-view-gutter] rule — SC-017 has no paint hook'
    ).toBeGreaterThanOrEqual(0);
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart));
    expect(rule).toContain('background-color: var(--rwa-code-preview-editor-bg)');
    expect(rule, 'bg-inherit was the gap-ring failure mode').not.toMatch(/background[^;]*inherit/);
  });

  it('gives the code pane opaque chrome, overflow clip, and a left separator (boundary)', () => {
    const ruleStart = css.indexOf('.rwa-code-preview-code-pane');
    expect(ruleStart, 'missing .rwa-code-preview-code-pane rule').toBeGreaterThanOrEqual(0);
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart) + 1);
    expect(rule).toContain('background: var(--rwa-code-preview-editor-bg)');
    expect(rule).toContain('overflow: hidden');
    expect(rule).toContain('border-left: 1px solid var(--rwa-code-preview-ui-border)');
  });

  it('raises the gutter above scrolled source and isolates the pre (rev 2 — gap-ring-still)', () => {
    const gutterStart = css.indexOf('.rwa-code-preview-code [data-code-view-gutter]');
    expect(gutterStart).toBeGreaterThanOrEqual(0);
    const gutterRule = css.slice(gutterStart, css.indexOf('}', gutterStart));
    expect(gutterRule, 'gutter z-index is what stops <code> painting over sticky paint').toMatch(
      /z-index:\s*1/
    );
    expect(gutterRule).toContain('padding-left: 0.75rem');

    // `.rwa-code-preview-code` appears more than once; take the chrome block that
    // owns isolation / pad reclaim (before the font-size rule cluster).
    const codeBlocks = [...css.matchAll(/\.rwa-code-preview-code\s*\{/g)];
    expect(codeBlocks.length, 'expected at least one .rwa-code-preview-code rule').toBeGreaterThan(
      0
    );
    let foundIsolation = false;
    let foundPadZero = false;
    let foundBorderZero = false;
    for (const match of codeBlocks) {
      const start = match.index!;
      const rule = css.slice(start, css.indexOf('}', start) + 1);
      if (rule.includes('isolation: isolate')) foundIsolation = true;
      if (/padding-left:\s*0/.test(rule)) foundPadZero = true;
      if (/border-left-width:\s*0/.test(rule)) foundBorderZero = true;
    }
    expect(
      foundIsolation,
      'pre isolation: isolate missing — stacking context for gutter z-index'
    ).toBe(true);
    expect(foundPadZero, 'pre padding-left: 0 missing — kit left pad was the glyph hole').toBe(
      true
    );
    expect(foundBorderZero, 'pre border-left-width: 0 missing').toBe(true);
  });

  it('fills the tree slot with the sidebar ground (boundary)', () => {
    const ruleStart = css.indexOf('.rwa-code-preview-tree-slot');
    expect(ruleStart, 'missing .rwa-code-preview-tree-slot rule').toBeGreaterThanOrEqual(0);
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart));
    expect(rule).toContain('background: var(--rwa-code-preview-sidebar-bg)');
  });

  it('does not put the join separator on the tree rail (failure — would shrink 280px)', () => {
    // Separator on the tree would shrink content under box-border and move SF-13
    // layout-probe V3's measured rail. Code Draft self-review caught this once.
    const treeRuleStart = css.indexOf('.rwa-code-preview-tree {');
    expect(treeRuleStart).toBeGreaterThanOrEqual(0);
    const treeRule = css.slice(treeRuleStart, css.indexOf('\n}', treeRuleStart) + 2);
    expect(treeRule, 'border-right on the tree rail would perturb the 280px probe').not.toMatch(
      /border-right\s*:/
    );

    const slotStart = css.indexOf('.rwa-code-preview-tree-slot');
    const slotRule = css.slice(slotStart, css.indexOf('}', slotStart));
    expect(slotRule).not.toMatch(/border-right\s*:/);
  });
});

describe('opaque join wrapper class names (SC-017)', () => {
  it('PreviewCodePane roots the selected-file chrome on rwa-code-preview-code-pane', () => {
    const pane = stripComments(readApp(PANE_PATH));
    expect(pane).toContain('rwa-code-preview-code-pane');
    // Empty state stays outside the chrome — no false opacity claim when idle.
    const emptyReturn = pane.indexOf('rwa-code-preview-empty');
    const paneClass = pane.indexOf('rwa-code-preview-code-pane');
    expect(emptyReturn, 'empty state marker missing').toBeGreaterThanOrEqual(0);
    expect(paneClass, 'pane class must appear after the empty-state branch').toBeGreaterThan(
      emptyReturn
    );
  });

  it('PreviewDrawerBody wraps the file tree in rwa-code-preview-tree-slot', () => {
    const body = stripComments(readApp(BODY_PATH));
    expect(body).toContain('rwa-code-preview-tree-slot');
    expect(body).toContain('TREE_PANE_WIDTH_PX');
  });
});

describe('inspected-chip ring is unchanged by SF-20 (AS-2)', () => {
  it('keeps the inspection ring tokens on TogglePill — and only there among SF-20 surfaces', () => {
    const pill = stripComments(readApp(PILL_PATH));
    for (const token of CHIP_RING_TOKENS) {
      expect(pill, `TogglePill lost ring token ${token}`).toContain(token);
    }

    for (const surface of SF20_SURFACES) {
      const source = stripComments(readApp(surface));
      for (const token of CHIP_RING_TOKENS) {
        expect(
          source.includes(token),
          `SC-017 surface ${surface} must not own chip ring token ${token} (AS-2)`
        ).toBe(false);
      }
    }
  });

  it('does not import inspected-anchor from the three SF-20 join surfaces', () => {
    // The fix is drawer layout / CSS. Importing the inspection store into the
    // pane would be a scope shift into chip-cue territory.
    for (const surface of SF20_SURFACES) {
      const source = stripComments(readApp(surface));
      expect(source, `${surface} imports inspected-anchor`).not.toMatch(/inspected-anchor/);
      expect(source, `${surface} imports useIsInspected`).not.toMatch(/useIsInspected/);
    }
  });

  it('leaves inspected-anchor modules free of code-preview join class names', () => {
    const anchorFiles = [
      'src/features/wizard/inspected-anchor/inspectedAnchorStore.ts',
      'src/features/wizard/inspected-anchor/InspectedAnchorProvider.tsx',
      'src/features/wizard/inspected-anchor/useInspectedAnchor.ts',
      'src/features/wizard/inspected-anchor/index.ts',
    ] as const;
    for (const relativePath of anchorFiles) {
      const source = readFileSync(join(APP_ROOT, relativePath), 'utf8');
      expect(source).not.toContain('rwa-code-preview-code-pane');
      expect(source).not.toContain('rwa-code-preview-tree-slot');
      expect(source).not.toContain('data-code-view-gutter');
    }
  });
});

describe('layout-probe wires V11 for SC-017', () => {
  it('registers V11 with z-index + hit-test + pixel-band oracle (not backgroundColor alone)', () => {
    const probe = readFileSync(join(REPO_ROOT, 'apps/rwa-wizard/scripts/layout-probe.mjs'), 'utf8');
    const checks = readFileSync(
      join(REPO_ROOT, 'apps/rwa-wizard/scripts/layout-probe.checks.mjs'),
      'utf8'
    );
    expect(probe).toMatch(/['"]V11['"]/);
    expect(probe).toContain('checkOpaqueJoin');
    expect(probe).toContain('analyseGutterBand');
    expect(probe).toContain('decodePngRgba');
    expect(probe).toContain('gutterZIndex');
    expect(probe).toContain('hitTest');
    expect(checks).toContain('measureOpaqueJoin');
    expect(checks).toContain('cleanupOpaqueJoin');
    expect(checks).toContain('visibleGutter');
    expect(checks).toContain('gutterZIndex');
    expect(checks).toContain('codeAboveGutter');
    expect(checks).toContain('SC-017');
    expect(checks).toContain('gap-ring-still');
  });
});
