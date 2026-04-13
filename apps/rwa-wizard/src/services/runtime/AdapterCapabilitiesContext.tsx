import { createContext, useContext, useMemo } from 'react';

import type { AddressingCapability, ExplorerCapability } from '@openzeppelin/ui-types';

import type { TargetAdapterCapabilities } from './types';

const AdapterCapabilitiesContext = createContext<TargetAdapterCapabilities | null>(null);

export const AdapterCapabilitiesProvider = AdapterCapabilitiesContext.Provider;

/**
 * Returns the full adapter capabilities for the active target, or null if
 * not yet loaded / target has no adapter support.
 */
export function useAdapterCapabilities(): TargetAdapterCapabilities | null {
  return useContext(AdapterCapabilitiesContext);
}

/**
 * Returns the AddressingCapability for the active target, or undefined if
 * not available. Convenience shortcut for the most common capability need.
 */
export function useAddressing(): AddressingCapability | undefined {
  return useContext(AdapterCapabilitiesContext)?.addressing;
}

/**
 * Returns an ExplorerCapability for the given network name. Matches against
 * the adapter's network catalog by `network` field or `id` substring.
 * Falls back to the first available network when no name is provided.
 */
export function useExplorer(networkName?: string): ExplorerCapability | null {
  const caps = useContext(AdapterCapabilitiesContext);
  return useMemo(() => {
    if (!caps) return null;
    const networks = caps.networkCatalog.getNetworks();
    const network = networkName
      ? networks.find((n) => n.network === networkName || n.id.includes(networkName))
      : networks[0];
    if (!network) return null;
    return caps.createExplorer(network);
  }, [caps, networkName]);
}
