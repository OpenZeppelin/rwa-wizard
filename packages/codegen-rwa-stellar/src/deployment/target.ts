import { createExplorer } from '@openzeppelin/adapter-stellar/explorer';
import { stellarPublic, stellarTestnet } from '@openzeppelin/adapter-stellar/networks';
import type { CustomDeploymentTarget, DeploymentTarget } from '@openzeppelin/rwa-config';
import type { StellarNetworkConfig } from '@openzeppelin/ui-types';

const EXPLORER_ADDRESS_PLACEHOLDER = 'CBHQGTSBJWA54K67RSG3JPXSZY5IXIZ4FSLJM4PQ33FA3FYCU5YZV7MZ';

const STELLAR_PRESET_NETWORKS = {
  'stellar-public': stellarPublic,
  'stellar-testnet': stellarTestnet,
} as const;

type SupportedStellarPresetNetworkId = keyof typeof STELLAR_PRESET_NETWORKS;

export interface ResolvedStellarDeploymentTarget {
  displayName: string;
  networkFlag: string;
  explorerUrlTemplate?: string;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled deployment target: ${JSON.stringify(value)}`);
}

export function getSupportedStellarPresetNetworkIds(): readonly SupportedStellarPresetNetworkId[] {
  return Object.keys(STELLAR_PRESET_NETWORKS) as SupportedStellarPresetNetworkId[];
}

export function getStellarPresetNetworkById(networkId: string): StellarNetworkConfig | undefined {
  return STELLAR_PRESET_NETWORKS[networkId as SupportedStellarPresetNetworkId];
}

function createExplorerUrlTemplate(networkConfig: StellarNetworkConfig): string | undefined {
  const explorer = createExplorer(networkConfig);
  const explorerUrl = explorer.getExplorerUrl(EXPLORER_ADDRESS_PLACEHOLDER);
  if (!explorerUrl) {
    return undefined;
  }

  return explorerUrl.replace(EXPLORER_ADDRESS_PLACEHOLDER, '__CONTRACT_ADDRESS__');
}

function createMinimalCustomStellarNetworkConfig(
  target: CustomDeploymentTarget
): StellarNetworkConfig {
  return {
    id: 'stellar-custom',
    exportConstName: 'stellarCustom',
    name: target.label?.trim() || 'Custom RPC',
    ecosystem: 'stellar',
    network: 'stellar',
    type: 'devnet',
    isTestnet: true,
    horizonUrl: '',
    sorobanRpcUrl: target.rpcUrl,
    networkPassphrase: 'Custom Stellar Network',
    explorerUrl: target.explorerUrl,
  };
}

export function resolveStellarDeploymentTarget(
  target: DeploymentTarget
): ResolvedStellarDeploymentTarget {
  if (target.ecosystem !== 'stellar') {
    throw new Error(
      `Unsupported deployment ecosystem "${target.ecosystem}" for codegen-rwa-stellar`
    );
  }

  switch (target.kind) {
    case 'preset': {
      const networkConfig = getStellarPresetNetworkById(target.networkId);
      if (!networkConfig) {
        throw new Error(
          `Unsupported Stellar preset network "${target.networkId}". Supported networks: ${getSupportedStellarPresetNetworkIds().join(', ')}`
        );
      }

      return {
        displayName: networkConfig.isTestnet ? 'Stellar Testnet' : 'Stellar Mainnet',
        networkFlag: networkConfig.isTestnet ? '--network testnet' : '--network mainnet',
        explorerUrlTemplate: createExplorerUrlTemplate(networkConfig),
      };
    }

    case 'custom': {
      const networkConfig = createMinimalCustomStellarNetworkConfig(target);
      return {
        displayName: target.label?.trim() || `Custom RPC (${target.rpcUrl})`,
        networkFlag: `--rpc-url ${target.rpcUrl}`,
        explorerUrlTemplate: createExplorerUrlTemplate(networkConfig),
      };
    }

    default:
      return assertNever(target);
  }
}
