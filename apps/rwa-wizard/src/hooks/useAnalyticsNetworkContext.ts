import { useCallback, useMemo } from 'react';

import { useAllNetworks } from './useAllNetworks';
import type { AnalyticsNetworkContext } from './useRwaWizardAnalytics';

/**
 * Resolver from a network id to the {@link AnalyticsNetworkContext} attached
 * to wizard analytics events.
 *
 * The ecosystem is looked up in the lightweight `/networks` catalogue (see
 * {@link useAllNetworks}); until that catalogue has loaded — or when the id is
 * unknown — the ecosystem is left `null` and the analytics hook sends
 * `'unknown'`. An explicit `ecosystemHint` (e.g. from a preset deployment
 * target) wins over the lookup so events are complete before the catalogue
 * resolves.
 */
export type AnalyticsNetworkResolver = (
  networkId: string | null | undefined,
  ecosystemHint?: string | null
) => AnalyticsNetworkContext;

/**
 * Returns a stable {@link AnalyticsNetworkResolver}. Use it when the network
 * is only known at event time (e.g. the destination of a sidebar click).
 */
export function useAnalyticsNetworkResolver(): AnalyticsNetworkResolver {
  const { networks } = useAllNetworks();

  return useCallback<AnalyticsNetworkResolver>(
    (networkId, ecosystemHint) => ({
      networkId: networkId ?? null,
      ecosystem: ecosystemHint ?? networks.find((n) => n.id === networkId)?.ecosystem ?? null,
    }),
    [networks]
  );
}

/**
 * Memoised {@link AnalyticsNetworkContext} for a network the component is
 * currently rendering for (e.g. the `/wizard/:networkId` route segment).
 */
export function useAnalyticsNetworkContext(
  networkId: string | null | undefined,
  ecosystemHint?: string | null
): AnalyticsNetworkContext {
  const resolve = useAnalyticsNetworkResolver();
  return useMemo(() => resolve(networkId, ecosystemHint), [resolve, networkId, ecosystemHint]);
}
