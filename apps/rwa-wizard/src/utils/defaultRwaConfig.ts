import type { RWAConfig } from '@openzeppelin/rwa-config';

export const DEFAULT_DECIMALS = 7;
export const DEFAULT_NETWORK = 'testnet';

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
      network: DEFAULT_NETWORK,
    },
  };
}
