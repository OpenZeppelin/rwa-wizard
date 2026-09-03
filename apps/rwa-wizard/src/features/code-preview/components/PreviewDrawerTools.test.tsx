import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewDrawerTools } from './PreviewDrawerTools';

describe('PreviewDrawerTools', () => {
  it('names and presses the tree toggle from its state', () => {
    const onToggleTree = vi.fn();
    const { rerender } = render(
      <PreviewDrawerTools
        treeVisible
        onToggleTree={onToggleTree}
        maximized={false}
        onToggleMaximize={() => {}}
      />
    );
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
      />
    );
    expect(screen.getByRole('button', { name: 'Show file tree' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('names and presses the maximize toggle from its state', () => {
    const onToggleMaximize = vi.fn();
    const { rerender } = render(
      <PreviewDrawerTools
        treeVisible
        onToggleTree={() => {}}
        maximized={false}
        onToggleMaximize={onToggleMaximize}
      />
    );
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
      />
    );
    expect(screen.getByRole('button', { name: 'Restore preview size' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('groups the tools under an accessible name', () => {
    render(
      <PreviewDrawerTools
        treeVisible
        onToggleTree={() => {}}
        maximized={false}
        onToggleMaximize={() => {}}
      />
    );
    expect(screen.getByRole('group', { name: 'Preview layout' })).toBeInTheDocument();
  });
});
