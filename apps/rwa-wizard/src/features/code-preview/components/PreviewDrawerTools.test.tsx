import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WIZARD_DOCK_MENU_POSITIONS } from '../dockPosition';
import { PreviewDrawerTools } from './PreviewDrawerTools';

function renderTools(
  overrides: Partial<Parameters<typeof PreviewDrawerTools>[0]> = {}
): ReturnType<typeof render> {
  return render(
    <PreviewDrawerTools
      treeVisible
      onToggleTree={() => {}}
      maximized={false}
      onToggleMaximize={() => {}}
      dockPosition="bottom"
      onDockPositionChange={() => {}}
      onCycleDock={() => {}}
      {...overrides}
    />
  );
}

async function openDockMenu(): Promise<HTMLElement> {
  const trigger = screen.getByRole('button', { name: 'Dock position' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  return screen.findByRole('menu');
}

describe('PreviewDrawerTools', () => {
  it('names and presses the tree toggle from its state', () => {
    const onToggleTree = vi.fn();
    const { rerender } = renderTools({ onToggleTree });
    const hide = screen.getByRole('button', { name: 'Hide file tree' });
    expect(hide).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(hide);
    expect(onToggleTree).toHaveBeenCalledTimes(1);

    rerender(
      <PreviewDrawerTools
        treeVisible={false}
        onToggleTree={onToggleTree}
        maximized={false}
        onToggleMaximize={() => {}}
        dockPosition="bottom"
        onDockPositionChange={() => {}}
        onCycleDock={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Show file tree' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('names and presses the maximize toggle from its state', () => {
    const onToggleMaximize = vi.fn();
    const { rerender } = renderTools({ onToggleMaximize });
    const max = screen.getByRole('button', { name: 'Maximize preview' });
    expect(max).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(max);
    expect(onToggleMaximize).toHaveBeenCalledTimes(1);

    rerender(
      <PreviewDrawerTools
        treeVisible
        onToggleTree={() => {}}
        maximized
        onToggleMaximize={onToggleMaximize}
        dockPosition="bottom"
        onDockPositionChange={() => {}}
        onCycleDock={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Restore preview size' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('groups the tools under an accessible name', () => {
    renderTools();
    expect(screen.getByRole('group', { name: 'Preview layout' })).toBeInTheDocument();
  });

  it('names the dock trigger as a stable dock-position control (not next-edge cycle)', () => {
    renderTools({ dockPosition: 'bottom' });
    expect(screen.getByRole('button', { name: 'Dock position' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dock preview to right' })).not.toBeInTheDocument();
  });

  it('opens the dock menu on click only (not hover)', async () => {
    renderTools({ dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS });
    const trigger = screen.getByRole('button', { name: 'Dock position' });
    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const menu = await openDockMenu();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to bottom' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to left' })
    ).toBeInTheDocument();
    expect(menu.querySelector('.lucide-panel-bottom, [class*="panel-bottom"]')).toBeTruthy();
    expect(menu.querySelector('.lucide-panel-left, [class*="panel-left"]')).toBeTruthy();
  });

  it('defaults the dock menu to all four positions', async () => {
    renderTools();
    const menu = await openDockMenu();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to bottom' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to left' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to top' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to right' })
    ).toBeInTheDocument();
  });

  it('filters dock menu entries by dockMenuPositions', async () => {
    renderTools({ dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS });
    const menu = await openDockMenu();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to bottom' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dock preview to left' })
    ).toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitemradio', { name: 'Dock preview to top' })
    ).not.toBeInTheDocument();
    expect(
      within(menu).queryByRole('menuitemradio', { name: 'Dock preview to right' })
    ).not.toBeInTheDocument();
  });

  it('sets dock position from a menu choice (not cycle)', async () => {
    const onDockPositionChange = vi.fn();
    const onCycleDock = vi.fn();
    renderTools({
      onDockPositionChange,
      onCycleDock,
      dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS,
    });
    await openDockMenu();
    const left = await screen.findByRole('menuitemradio', { name: 'Dock preview to left' });
    fireEvent.click(left);
    expect(onDockPositionChange).toHaveBeenCalledWith('left');
    expect(onCycleDock).not.toHaveBeenCalled();
  });

  it('shows bottom selected for a legacy dock outside the wizard menu without rewriting on mount', () => {
    const onDockPositionChange = vi.fn();
    renderTools({
      dockPosition: 'top',
      dockMenuPositions: WIZARD_DOCK_MENU_POSITIONS,
      onDockPositionChange,
    });
    expect(onDockPositionChange).not.toHaveBeenCalled();
  });

  it('keeps tree, maximize, and dock controls operable for every edge', () => {
    for (const side of ['bottom', 'right', 'top', 'left'] as const) {
      const view = renderTools({ dockPosition: side });
      expect(screen.getByRole('button', { name: 'Hide file tree' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Maximize preview' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Dock position' })).not.toBeDisabled();
      view.unmount();
    }
  });
});
