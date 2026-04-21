import { useMemo, type ReactNode } from 'react';

import { coreCopy, getCopyForChain, isChainId } from '@openzeppelin/rwa-wizard-copy';

import { CopyContext } from './CopyContext';

interface CopyProviderProps {
  /**
   * Active wizard target id. Pass `null` or omit when there is no active
   * target — the provider falls back to
   * `coreCopy`, which already covers every chain-neutral category.
   */
  targetId?: string | null;
  children: ReactNode;
}

/**
 * Context provider that resolves the chain-appropriate copy dictionary once
 * per target load and memoizes the accessor object so consumers don't
 * re-render when the structural `targetId` string is unchanged.
 *
 * When a target is selected, the provider swaps in `getCopyForChain(targetId)`
 * so the same hook transparently picks up any chain-specific override for
 * the active target.
 */
export function CopyProvider({ targetId, children }: CopyProviderProps) {
  const value = useMemo(
    () => (targetId && isChainId(targetId) ? getCopyForChain(targetId) : coreCopy),
    [targetId]
  );

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}
