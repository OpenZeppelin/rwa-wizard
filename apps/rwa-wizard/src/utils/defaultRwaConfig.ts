import type { PresetDeploymentTarget, RWAConfig } from '@openzeppelin/rwa-config';

export const DEFAULT_DECIMALS = 7;
export const DEFAULT_DEPLOYMENT_TARGET: PresetDeploymentTarget = {
  kind: 'preset',
  ecosystem: 'stellar',
  networkId: 'stellar-testnet',
};

/** Default route segment for `/wizard/:networkId` — matches {@link DEFAULT_DEPLOYMENT_TARGET.networkId}. */
export const DEFAULT_WIZARD_NETWORK_ID = DEFAULT_DEPLOYMENT_TARGET.networkId;

export function createDefaultRwaConfig(): RWAConfig {
  return {
    token: {
      name: '',
      symbol: '',
      decimals: DEFAULT_DECIMALS,
      administrativeControls: {
        burnable: true,
        mintable: true,
        pausable: true,
      },
      documentManager: { enabled: false },
    },
    identityVerification: {
      claimTopics: [],
      trustedIssuers: [],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: {
      modules: [],
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: '' },
      roles: [],
    },
    deployment: {
      target: { ...DEFAULT_DEPLOYMENT_TARGET },
    },
  };
}
