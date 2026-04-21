import type { Ecosystem, EcosystemExport } from '@openzeppelin/ui-types';

import { getEcosystemDefinition } from './ecosystemManager';
import type { TargetAdapterCapabilities } from './types';

/**
 * Extracts Tier 1 (Declarative-profile) capabilities from an ecosystem
 * definition's capability factory map. Returns null if the adapter lacks
 * any required Tier 1 factory.
 */
function extractDeclarativeCapabilities(
  ecosystem: EcosystemExport
): TargetAdapterCapabilities | null {
  const { capabilities } = ecosystem;
  const addressingFactory = capabilities.addressing;
  const networkCatalogFactory = capabilities.networkCatalog;
  const uiLabelsFactory = capabilities.uiLabels;
  const explorerFactory = capabilities.explorer;

  if (!addressingFactory || !networkCatalogFactory || !explorerFactory) {
    return null;
  }

  return {
    addressing: addressingFactory(),
    networkCatalog: networkCatalogFactory(),
    uiLabels: uiLabelsFactory?.() ?? { getUiLabels: () => ({}) },
    createExplorer: (networkConfig) => explorerFactory(networkConfig),
  };
}

/**
 * Resolves Declarative-profile capabilities for a target ecosystem.
 *
 * Delegates the actual adapter import to {@link getEcosystemDefinition} in the
 * shared ecosystem manager, which owns the lazy-load + promise-cache logic so
 * we don't double-import adapter packages from this layer.
 */
export async function loadAdapterCapabilities(
  targetId: string
): Promise<TargetAdapterCapabilities | null> {
  const ecosystem = await getEcosystemDefinition(targetId as Ecosystem);
  return ecosystem ? extractDeclarativeCapabilities(ecosystem) : null;
}
