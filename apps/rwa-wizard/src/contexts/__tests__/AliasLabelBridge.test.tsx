/**
 * Tests for AliasLabelBridge — mirrors Role Manager / UI Builder patterns.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AliasLabelBridge } from '../AliasLabelBridge';

const {
  mockUseAliasLabelResolver,
  mockUseAliasSuggestionResolver,
  mockUseAliasEditCallbacks,
  mockAddressLabelProvider,
  mockAliasEditPopover,
  mockUseAliasEditState,
  mockToastError,
  mockOnSave,
  mockUseWizardStore,
} = vi.hoisted(() => ({
  mockUseAliasLabelResolver: vi.fn(() => ({ resolveLabel: vi.fn() })),
  mockUseAliasSuggestionResolver: vi.fn(() => ({ resolveSuggestions: vi.fn(() => []) })),
  mockOnSave: vi.fn(async () => 'rec-1'),
  mockUseAliasEditCallbacks: vi.fn(),
  // Typed loosely as a generic component spy so tests can introspect any
  // prop the bridge passes (children + the new optional onEditLabel).
  mockAddressLabelProvider: vi.fn((props: Record<string, unknown>) => (
    <>{props.children as React.ReactNode}</>
  )),
  mockAliasEditPopover: vi.fn((_props: Record<string, unknown>) => null),
  mockUseAliasEditState: vi.fn(),
  mockToastError: vi.fn(),
  mockUseWizardStore: vi.fn(),
}));

mockUseAliasEditCallbacks.mockImplementation(() => ({
  onLookup: vi.fn(),
  onSave: mockOnSave,
  onRemove: vi.fn(),
}));

mockUseAliasEditState.mockImplementation(() => ({
  editing: null,
  onEditLabel: vi.fn(),
  handleClose: vi.fn(),
  lastClickRef: { current: { x: 0, y: 0 } },
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
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
    AddressLabelProvider: mockAddressLabelProvider,
    AddressSuggestionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@openzeppelin/ui-renderer', () => ({
  AliasEditPopover: mockAliasEditPopover,
  useAliasEditState: mockUseAliasEditState,
}));

vi.mock('../../app/state/useWizardStore', () => ({
  useWizardStore: mockUseWizardStore,
}));

vi.mock('../../storage/database', () => ({
  db: { _testDb: true },
}));

function setActiveNetworkId(value: string | null) {
  mockUseWizardStore.mockImplementation(
    (selector: (s: { activeNetworkId: string | null }) => unknown) =>
      selector({ activeNetworkId: value })
  );
}

afterEach(() => {
  vi.clearAllMocks();
  mockOnSave.mockImplementation(async () => 'rec-1');
  mockUseAliasEditState.mockImplementation(() => ({
    editing: null,
    onEditLabel: vi.fn(),
    handleClose: vi.fn(),
    lastClickRef: { current: { x: 0, y: 0 } },
  }));
});

describe('AliasLabelBridge', () => {
  it('renders children', () => {
    setActiveNetworkId('stellar-testnet');
    render(
      <AliasLabelBridge>
        <div data-testid="child">Hello</div>
      </AliasLabelBridge>
    );

    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('passes network ID from wizard store to useAliasLabelResolver', () => {
    setActiveNetworkId('stellar-testnet');
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
    setActiveNetworkId('stellar-testnet');
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
    setActiveNetworkId('stellar-testnet');
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    expect(mockUseAliasEditCallbacks).toHaveBeenCalledWith(
      expect.objectContaining({ _testDb: true })
    );
  });

  it('exposes onEditLabel to AddressLabelProvider when an active network is set', () => {
    setActiveNetworkId('stellar-testnet');
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    const props = mockAddressLabelProvider.mock.calls[0]?.[0];
    expect(typeof props?.onEditLabel).toBe('function');
  });

  it('omits onEditLabel when no active network is known (hides pencil)', () => {
    setActiveNetworkId(null);
    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    const props = mockAddressLabelProvider.mock.calls[0]?.[0];
    expect(props?.onEditLabel).toBeUndefined();
  });

  it('passes a guarded onSave to AliasEditPopover that rejects missing networkId', async () => {
    setActiveNetworkId('stellar-testnet');
    mockUseAliasEditState.mockImplementation(() => ({
      editing: { address: '0xabc', networkId: undefined, anchorRect: new DOMRect(0, 0, 0, 0) },
      onEditLabel: vi.fn(),
      handleClose: vi.fn(),
      lastClickRef: { current: { x: 0, y: 0 } },
    }));

    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    const popoverProps = mockAliasEditPopover.mock.calls[0]?.[0] as {
      onSave: (input: { address: string; alias: string; networkId?: string }) => Promise<string>;
    };
    expect(popoverProps).toBeDefined();

    await expect(popoverProps.onSave({ address: '0xabc', alias: 'Treasury' })).rejects.toThrow(
      /Address Book/i
    );

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('passes through to storage.onSave when networkId is present', async () => {
    setActiveNetworkId('stellar-testnet');
    mockUseAliasEditState.mockImplementation(() => ({
      editing: {
        address: '0xabc',
        networkId: 'stellar-testnet',
        anchorRect: new DOMRect(0, 0, 0, 0),
      },
      onEditLabel: vi.fn(),
      handleClose: vi.fn(),
      lastClickRef: { current: { x: 0, y: 0 } },
    }));

    render(
      <AliasLabelBridge>
        <div>Test</div>
      </AliasLabelBridge>
    );

    const popoverProps = mockAliasEditPopover.mock.calls[0]?.[0] as {
      onSave: (input: { address: string; alias: string; networkId?: string }) => Promise<string>;
    };

    await expect(
      popoverProps.onSave({
        address: '0xabc',
        alias: 'Treasury',
        networkId: 'stellar-testnet',
      })
    ).resolves.toBe('rec-1');

    expect(mockOnSave).toHaveBeenCalledWith({
      address: '0xabc',
      alias: 'Treasury',
      networkId: 'stellar-testnet',
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
