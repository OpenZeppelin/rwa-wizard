import { createContext, useContext } from 'react';

import type { AddressingCapability } from '@openzeppelin/ui-types';

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
