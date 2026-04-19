import type { ReactNode } from 'react';

import { AdapterCapabilitiesContext } from './adapterCapabilitiesContext';
import type { TargetAdapterCapabilities } from './types';

interface AdapterCapabilitiesProviderProps {
  value: TargetAdapterCapabilities | null;
  children: ReactNode;
}

/**
 * Provides adapter capabilities for the active target to its descendants.
 *
 * Lives in its own component-only file so React Fast Refresh can keep the HMR
 * boundary clean; the hooks that read this context live in a sibling module.
 */
export function AdapterCapabilitiesProvider({ value, children }: AdapterCapabilitiesProviderProps) {
  return (
    <AdapterCapabilitiesContext.Provider value={value}>
      {children}
    </AdapterCapabilitiesContext.Provider>
  );
}
