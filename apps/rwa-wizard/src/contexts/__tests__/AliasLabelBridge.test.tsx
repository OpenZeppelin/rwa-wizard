/**
 * Tests for AliasLabelBridge — mirrors Role Manager / UI Builder patterns.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AliasLabelBridge } from '../AliasLabelBridge';

const { mockUseAliasLabelResolver, mockUseAliasSuggestionResolver, mockUseAliasEditCallbacks } =
  vi.hoisted(() => ({
    mockUseAliasLabelResolver: vi.fn(() => ({ resolveLabel: vi.fn() })),
    mockUseAliasSuggestionResolver: vi.fn(() => ({ resolveSuggestions: vi.fn(() => []) })),
    mockUseAliasEditCallbacks: vi.fn(() => ({ onLookup: vi.fn(), onSave: vi.fn() })),
  }));

vi.mock('@openzeppelin/ui-storage', () => ({
  useAliasLabelResolver: mockUseAliasLabelResolver,
  useAliasSuggestionResolver: mockUseAliasSuggestionResolver,
  useAliasEditCallbacks: mockUseAliasEditCallbacks,
}));

vi.mock('@openzeppelin/ui-components', async () => {
  const actual = await vi.importActual('@openzeppelin/ui-components');
  return {
    ...actual,
    AddressLabelProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AddressSuggestionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@openzeppelin/ui-renderer', () => ({
  AliasEditPopover: () => null,
  useAliasEditState: vi.fn(() => ({
    editing: null,
    onEditLabel: vi.fn(),
    handleClose: vi.fn(),
    lastClickRef: { current: { x: 0, y: 0 } },
  })),
}));

vi.mock('../../app/state/useWizardStore', () => ({
  useWizardStore: vi.fn((selector: (s: { activeNetworkId: string | null }) => unknown) =>
    selector({ activeNetworkId: 'stellar-testnet' })
  ),
}));

vi.mock('../../storage/database', () => ({
  db: { _testDb: true },
}));

describe('AliasLabelBridge', () => {
  it('renders children', () => {
    render(
      <AliasLabelBridge>
        <div data-testid="child">Hello</div>
      </AliasLabelBridge>
    );

    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('passes network ID from wizard store to useAliasLabelResolver', () => {
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    expect(mockUseAliasLabelResolver).toHaveBeenCalledWith(
      expect.objectContaining({ _testDb: true }),
      expect.objectContaining({ networkId: 'stellar-testnet' })
    );
  });

  it('passes db to useAliasSuggestionResolver', () => {
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    expect(mockUseAliasSuggestionResolver).toHaveBeenCalledWith(
      expect.objectContaining({ _testDb: true })
    );
  });

  it('passes db to useAliasEditCallbacks', () => {
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    expect(mockUseAliasEditCallbacks).toHaveBeenCalledWith(
      expect.objectContaining({ _testDb: true })
    );
  });
});
