/**
 * Tests for the analytics network-context resolver used by wizard call sites.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NetworkConfig } from '@openzeppelin/ui-types';

import {
  useAnalyticsNetworkContext,
  useAnalyticsNetworkResolver,
} from '../useAnalyticsNetworkContext';

const mockNetworks: { current: Pick<NetworkConfig, 'id' | 'ecosystem'>[] } = { current: [] };

vi.mock('../useAllNetworks', () => ({
  useAllNetworks: () => ({ networks: mockNetworks.current, isLoading: false, error: null }),
}));

const NETWORKS: Pick<NetworkConfig, 'id' | 'ecosystem'>[] = [
  { id: 'stellar-testnet', ecosystem: 'stellar' },
  { id: 'ethereum-sepolia', ecosystem: 'evm' },
];

describe('useAnalyticsNetworkResolver', () => {
  beforeEach(() => {
    mockNetworks.current = NETWORKS;
  });

  it('resolves the ecosystem from the network catalogue', () => {
    const { result } = renderHook(() => useAnalyticsNetworkResolver());
    expect(result.current('ethereum-sepolia')).toEqual({
      networkId: 'ethereum-sepolia',
      ecosystem: 'evm',
    });
  });

  it('prefers an explicit ecosystem hint over the lookup', () => {
    const { result } = renderHook(() => useAnalyticsNetworkResolver());
    expect(result.current('stellar-testnet', 'custom-eco')).toEqual({
      networkId: 'stellar-testnet',
      ecosystem: 'custom-eco',
    });
  });

  it('leaves the ecosystem unresolved for an unknown network id', () => {
    const { result } = renderHook(() => useAnalyticsNetworkResolver());
    expect(result.current('nope')).toEqual({ networkId: 'nope', ecosystem: null });
  });

  it('leaves the ecosystem unresolved before the catalogue has loaded', () => {
    mockNetworks.current = [];
    const { result } = renderHook(() => useAnalyticsNetworkResolver());
    expect(result.current('stellar-testnet')).toEqual({
      networkId: 'stellar-testnet',
      ecosystem: null,
    });
  });

  it('maps a missing network id to null fields', () => {
    const { result } = renderHook(() => useAnalyticsNetworkResolver());
    expect(result.current(null)).toEqual({ networkId: null, ecosystem: null });
    expect(result.current(undefined)).toEqual({ networkId: null, ecosystem: null });
  });

  it('returns a stable resolver while the catalogue is unchanged', () => {
    const { result, rerender } = renderHook(() => useAnalyticsNetworkResolver());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('useAnalyticsNetworkContext', () => {
  beforeEach(() => {
    mockNetworks.current = NETWORKS;
  });

  it('memoises the context for the rendered network', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useAnalyticsNetworkContext(id),
      { initialProps: { id: 'stellar-testnet' } }
    );
    expect(result.current).toEqual({ networkId: 'stellar-testnet', ecosystem: 'stellar' });
    const first = result.current;
    rerender({ id: 'stellar-testnet' });
    expect(result.current).toBe(first);

    rerender({ id: 'ethereum-sepolia' });
    expect(result.current).toEqual({ networkId: 'ethereum-sepolia', ecosystem: 'evm' });
  });
});
