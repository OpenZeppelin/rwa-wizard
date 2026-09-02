import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { APP_ROOT, stripComments } from '../../test/helpers/sourceScan';

/**
 * Sheet chrome: bottom/top keep a visible drag separator; side docks put the
 * substitutions notice on its own row and align tools with kit Close.
 * Happy-dom cannot see geometry (INV-24).
 */

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), 'utf8');
}

describe('code-preview sheet chrome packing', () => {
  const css = stripComments(readApp('src/features/code-preview/code-preview.css'));
  const drawer = readApp('src/features/code-preview/components/CodePreviewDrawer.tsx');
  const header = readApp('src/features/code-preview/components/PreviewDrawerHeader.tsx');

  it('stamps rwa-code-preview-sheet on the BottomSheet', () => {
    expect(drawer).toContain('className="rwa-code-preview-sheet"');
  });

  it('does not overlay the bottom/top separator under the header (drag grip stays visible)', () => {
    // Former packing used display:contents on the bottom/top chrome row and hid the grip.
    // Assert the bottom/top chrome-child rules only set align-items (side docks may use contents).
    const bottomChrome = css.match(
      /\[data-side='bottom'\][^{]+> \[data-slot='bottom-sheet-chrome'\][^{]+> div:first-child\s*\{([^}]+)\}/
    );
    const topChrome = css.match(
      /\[data-side='top'\][^{]+> \[data-slot='bottom-sheet-chrome'\][^{]+> div:first-child\s*\{([^}]+)\}/
    );
    expect(bottomChrome?.[1] ?? '', 'bottom chrome-child rule').toMatch(/align-items:\s*center/);
    expect(bottomChrome?.[1] ?? '').not.toMatch(/display:\s*contents/);
    expect(topChrome?.[1] ?? '', 'top chrome-child rule').toMatch(/align-items:\s*center/);
    expect(topChrome?.[1] ?? '').not.toMatch(/display:\s*contents/);
  });

  it('places side-dock notice on its own row and aligns tools with Close', () => {
    expect(css).toContain("[data-side='left']");
    expect(css).toContain("[data-side='right']");
    expect(css).toContain('.rwa-code-preview-sheet-notice');
    expect(css).toContain('grid-column: 1 / -1');
    expect(css).toContain("[data-slot='bottom-sheet-close']");
    expect(css).toContain('grid-row: 2');
    expect(css).toContain('margin-top: 0.5rem');
  });

  it('sizes kit Close to match tool buttons (size-9 hit area)', () => {
    expect(css).toContain("[data-slot='bottom-sheet-close']");
    expect(css).toContain('width: 2.25rem');
    expect(css).toContain('height: 2.25rem');
  });

  it('centers bottom/top chrome so Close shares the tools baseline', () => {
    expect(css).toMatch(
      /\[data-side='bottom'\][\s\S]*?> \[data-slot='bottom-sheet-chrome'\][\s\S]*?align-items:\s*center/
    );
    expect(css).toMatch(
      /\[data-side='top'\][\s\S]*?> \[data-slot='bottom-sheet-chrome'\][\s\S]*?align-items:\s*center/
    );
    expect(css).toContain('align-self: center');
  });

  it('does not force a dark outer sheet shell (light chrome)', () => {
    expect(css).not.toMatch(
      /\[data-slot=['"]bottom-sheet['"]\]\.rwa-code-preview-sheet\s*\{[^}]*background:\s*#21252b/
    );
  });

  it('does not strip kit width/height size transitions on the sheet', () => {
    expect(css).not.toMatch(
      /\[data-slot=['"]bottom-sheet['"]\]\.rwa-code-preview-sheet\s*\{[^}]*transition-property:\s*translate,\s*opacity/
    );
  });

  it('keeps the header content class and notice wrapper for side-grid targeting', () => {
    expect(header).toContain('rwa-code-preview-sheet-header');
    expect(header).toContain('rwa-code-preview-sheet-notice');
  });
});
