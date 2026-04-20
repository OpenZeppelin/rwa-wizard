import type { EcosystemExport } from '@openzeppelin/ui-types';

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
 * Dynamically imports the adapter package for a target and extracts
 * Declarative-profile capabilities. Returns null for unknown targets
 * or adapters that lack required Tier 1 factories.
 */
export async function loadAdapterCapabilities(
  targetId: string
): Promise<TargetAdapterCapabilities | null> {
  switch (targetId) {
    case 'stellar': {
      const mod = await import('@openzeppelin/adapter-stellar');
      return extractDeclarativeCapabilities(mod.ecosystemDefinition);
    }
    case 'evm': {
      const mod = await import('@openzeppelin/adapter-evm');
      return extractDeclarativeCapabilities(mod.ecosystemDefinition);
    }
    default:
      return null;
  }
}
