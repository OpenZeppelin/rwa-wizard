import { useContext } from 'react';

import type { ChainCopy } from '@openzeppelin/rwa-wizard-copy';

import { CopyContext } from './CopyContext';

/**
 * Read the active copy dictionary. Safe to call outside a `CopyProvider`; in
 * that case `coreCopy` is returned so chain-neutral copy still works.
 *
 * Kept in its own module so the provider file exports only React components,
 * which keeps Vite's Fast Refresh working for hot reloads.
 */
export function useCopy(): ChainCopy {
  return useContext(CopyContext);
}
