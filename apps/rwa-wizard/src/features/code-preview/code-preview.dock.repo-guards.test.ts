import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  APP_ROOT,
  findTokenAcross,
  readScannedSources,
  stripComments,
} from '../../test/helpers/sourceScan';

/**
 * SF-23 absence / architecture guards:
 * INV-19 — no dock under impact/
 * INV-21 — no second pane / floating detach module
 * INV-7  — BottomSheet.side remains optional on published kit types
 */

const IMPACT_DIR = join(APP_ROOT, 'src/features/code-preview/impact');

function listFilesRecursive(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      out.push(...listFilesRecursive(absolute));
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      out.push(absolute);
    }
  }
  return out;
}

describe('SF-23 dock repo guards', () => {
  it('does not import dockPosition under impact/ (INV-19)', () => {
    const files = listFilesRecursive(IMPACT_DIR);
    expect(files.length, 'INV-19 guard must scan at least one impact module').toBeGreaterThan(0);

    const hits: string[] = [];
    for (const absolute of files) {
      const stripped = stripComments(readFileSync(absolute, 'utf8'));
      if (
        stripped.includes('dockPosition') ||
        stripped.includes('dockLayout') ||
        stripped.includes('onCycleDock') ||
        /from ['"].*dockPosition['"]/.test(stripped)
      ) {
        hits.push(absolute.replace(APP_ROOT + '/', ''));
      }
    }
    expect(
      hits,
      `INV-19: dock chrome must not fork impact-column truth; found: ${hits.join(', ')}`
    ).toEqual([]);
  });

  it('introduces no Detach / FloatingPreview module in code-preview (INV-21)', () => {
    const featureRoot = join(APP_ROOT, 'src/features/code-preview');
    const files = listFilesRecursive(featureRoot);
    expect(files.length).toBeGreaterThan(0);

    const relative = files.map((absolute) => absolute.replace(APP_ROOT + '/', ''));
    const forbiddenNames = relative.filter(
      (path) =>
        /Detach|FloatingPreview|PopOutPreview|UndockedPreview/i.test(path) &&
        !path.includes('.test.')
    );
    expect(
      forbiddenNames,
      `INV-21 / AS-4: dock edges only — forbidden modules: ${forbiddenNames.join(', ')}`
    ).toEqual([]);

    const sources = readScannedSources(
      relative.filter((path) => !path.includes('.test.') && !path.endsWith('.css'))
    );
    for (const token of ['FloatingPreview', 'DetachPreview', 'undockedPreview'] as const) {
      const hits = findTokenAcross(sources, token);
      expect(hits, `INV-21: forbidden token ${token}`).toEqual([]);
    }
  });

  it('keeps BottomSheet.side optional on the published kit types (INV-7)', () => {
    // SF-9: ambient stubs are gone; assert against ui-components ^3.9.0 typings.
    const dts = readFileSync(
      join(APP_ROOT, '../../node_modules/@openzeppelin/ui-components/dist/index.d.mts'),
      'utf8'
    );
    expect(dts).toContain('side?: BottomSheetSide');
    expect(dts).toMatch(
      /type BottomSheetSide\s*=\s*'top'\s*\|\s*'right'\s*\|\s*'bottom'\s*\|\s*'left'/
    );
  });

  it('AppRouter shrinks host height for bottom inset only (no side-edge vacate)', () => {
    const router = stripComments(
      readFileSync(join(APP_ROOT, 'src/app/routes/AppRouter.tsx'), 'utf8')
    );
    expect(router).toMatch(/h-\[calc\(100dvh-var\(--bottom-sheet-inset/);
    expect(router).toMatch(/\[html\[data-bottom-sheet-inset\]_&\]:hidden/);
    // Side/top docks overlay — AppRouter must not pad per edge.
    expect(router).not.toMatch(/data-bottom-sheet-side=top/);
    expect(router).not.toMatch(/data-bottom-sheet-side=left/);
    expect(router).not.toMatch(/data-bottom-sheet-side=right/);
    expect(router).not.toMatch(/pt-\[length:var\(--bottom-sheet-inset/);
    expect(router).not.toMatch(/pl-\[length:var\(--bottom-sheet-inset/);
    expect(router).not.toMatch(/pr-\[length:var\(--bottom-sheet-inset/);
    expect(router).not.toMatch(/w-\[calc\(100%-var\(--bottom-sheet-inset/);
  });

  it('resolveDockSheetLayout uses inset for bottom and overlay for other edges', () => {
    const layout = stripComments(
      readFileSync(join(APP_ROOT, 'src/features/code-preview/dockLayout.ts'), 'utf8')
    );
    expect(layout).toMatch(/side === 'bottom'/);
    expect(layout).toMatch(/'inset'/);
    expect(layout).toMatch(/'overlay'/);
  });

  it('CodePreviewDrawer passes side={dockPosition} to BottomSheet (INV-7, INV-13)', () => {
    const drawer = stripComments(
      readFileSync(
        join(APP_ROOT, 'src/features/code-preview/components/CodePreviewDrawer.tsx'),
        'utf8'
      )
    );
    expect(drawer).toMatch(/side=\{dockPosition\}/);
  });
});
