import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { APP_ROOT, stripComments } from '../../test/helpers/sourceScan';
import { WIZARD_DOCK_MENU_POSITIONS } from './dockPosition';

/**
 * Side-dock body layout: impact stacks above tree+code. Cheap structure guards
 * (INV-24 — no geometry in happy-dom).
 */

function readApp(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), 'utf8');
}

describe('side-dock impact band layout', () => {
  const css = stripComments(readApp('src/features/code-preview/code-preview.css'));
  const body = stripComments(readApp('src/features/code-preview/components/PreviewDrawerBody.tsx'));
  const tools = stripComments(
    readApp('src/features/code-preview/components/PreviewDrawerTools.tsx')
  );

  it('stamps data-dock from dockPosition on the preview row', () => {
    expect(body).toContain('data-dock={dockPosition}');
    expect(body).toContain('dockPosition: CodePreviewDockPosition');
  });

  it('stacks impact above tree+code for left/right via CSS grid', () => {
    expect(css).toContain("[data-dock='left']");
    expect(css).toContain("[data-dock='right']");
    expect(css).toContain('grid-column: 1 / -1');
    expect(css).toContain('.rwa-code-preview-tree-slot');
    expect(css).toContain('.rwa-code-preview-code-pane');
  });

  it('does not hide impact on narrow side docks when the tree is open', () => {
    expect(css).toContain(":not([data-dock='left']):not(");
    expect(css).toContain("[data-dock='right']");
  });

  it('uses lucide Dock as the dock-menu trigger (stable glyph, not cycle)', () => {
    expect(tools).toContain("from 'lucide-react'");
    expect(tools).toMatch(/\bDock\b/);
    expect(tools).toContain('<Dock className="size-4"');
    expect(tools).toContain('DropdownMenu');
    expect(tools).toContain('modal={false}');
    expect(tools).toContain('dockMenuPositions');
    expect(tools).toContain('PanelBottom');
    expect(tools).toContain('PanelLeft');
    expect(tools).toContain('DOCK_MENU_ICONS');
    expect(tools).toContain('data-rwa-preview-chrome');
    expect(tools).not.toContain('onOpenAutoFocus');
    expect(tools).not.toContain('onPointerEnter');
    expect(tools).not.toContain('onCycleDock');
    expect(tools).not.toContain('DOCK_ICON');
    expect(tools).not.toContain('nextDockPosition');
  });

  it('shares sidebar row height with the file tree via one CSS token', () => {
    expect(css).toContain('--rwa-code-preview-sidebar-item-height: 30px');
    expect(css).toContain('--rwa-code-preview-sidebar-row-padding');
    expect(css).toContain('padding-block: var(--rwa-code-preview-sidebar-row-padding)');
    expect(css).toContain('min-height: var(--rwa-code-preview-sidebar-item-height)');
    expect(css).toContain('.rwa-code-preview-impact-row');
    expect(css).toContain('.rwa-code-preview-impact-field');
    expect(css).toContain('.rwa-code-preview-impact-file');
  });

  it('WizardPage offers only bottom + left in the dock menu', () => {
    const wizardPage = stripComments(readApp('src/features/wizard/WizardPage.tsx'));
    expect(wizardPage).toContain('WIZARD_DOCK_MENU_POSITIONS');
    expect(wizardPage).toContain('dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS');
    expect([...WIZARD_DOCK_MENU_POSITIONS]).toEqual(['bottom', 'left']);
  });
});
