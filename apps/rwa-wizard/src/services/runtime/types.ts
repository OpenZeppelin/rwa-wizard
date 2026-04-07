import type {
  AddressingCapability,
  ExplorerCapability,
  NetworkCatalogCapability,
  NetworkConfig,
  UiLabelsCapability,
} from '@openzeppelin/ui-types';

/**
 * Declarative-profile adapter capabilities resolved for a target ecosystem.
 *
 * Tier 1 only: no wallet, no RPC, no side-effects. Addressing and labels are
 * network-independent; explorer requires a network to generate URLs.
 */
export interface TargetAdapterCapabilities {
  readonly addressing: AddressingCapability;
  readonly networkCatalog: NetworkCatalogCapability;
  readonly uiLabels: UiLabelsCapability;
  createExplorer(networkConfig: NetworkConfig): ExplorerCapability;
}
