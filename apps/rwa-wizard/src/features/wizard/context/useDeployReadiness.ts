import { useContext } from 'react';

import { DeployReadinessContext, type DeployReadinessContextValue } from './deployReadinessContext';

export function useDeployReadiness(): DeployReadinessContextValue {
  const ctx = useContext(DeployReadinessContext);
  if (!ctx) {
    throw new Error('useDeployReadiness must be used within DeployReadinessProvider');
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider during tests. */
export function useOptionalDeployReadiness(): DeployReadinessContextValue | null {
  return useContext(DeployReadinessContext);
}
