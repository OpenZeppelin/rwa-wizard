import { createContext } from 'react';

import type { TargetAdapterCapabilities } from './types';

/**
 * React context carrying the active target's adapter capabilities.
 *
 * This module is kept JSX-free so React Fast Refresh treats downstream hook
 * and provider files as component-only, avoiding HMR boundary warnings.
 *
 * Consumers should not use this export directly — import the provider from
 * `AdapterCapabilitiesProvider` or the hooks from `useAdapterCapabilities`.
 */
export const AdapterCapabilitiesContext = createContext<TargetAdapterCapabilities | null>(null);
