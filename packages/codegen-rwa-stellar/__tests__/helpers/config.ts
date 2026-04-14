import type { RWAConfig } from '@openzeppelin/rwa-config';

type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

const DEFAULT_ADMINISTRATIVE_CONTROLS = {
  burnable: true,
  mintable: true,
  pausable: true,
} as const;

const DEFAULT_IDENTITY_CONTROLS = {
  addressFreezing: true,
  partialTokenFreezing: true,
  recovery: true,
  forcedTransfers: true,
} as const;

function mergeConfig(base: RWAConfig, overrides: DeepPartial<RWAConfig>): RWAConfig {
  return {
    token: {
      ...base.token,
      ...overrides.token,
      administrativeControls: {
        ...base.token.administrativeControls,
        ...overrides.token?.administrativeControls,
      },
      documentManager: {
        ...base.token.documentManager,
        ...overrides.token?.documentManager,
      },
    },
    identityVerification: {
      ...base.identityVerification,
      ...overrides.identityVerification,
      controls: {
        ...base.identityVerification.controls,
        ...overrides.identityVerification?.controls,
      },
      claimTopics:
        (overrides.identityVerification?.claimTopics as RWAConfig['identityVerification']['claimTopics']) ??
        base.identityVerification.claimTopics,
      trustedIssuers:
        (overrides.identityVerification?.trustedIssuers as RWAConfig['identityVerification']['trustedIssuers']) ??
        base.identityVerification.trustedIssuers,
    },
    compliance: {
      ...base.compliance,
      ...overrides.compliance,
      modules:
        (overrides.compliance?.modules as RWAConfig['compliance']['modules']) ??
        base.compliance.modules,
    },
    accessControl: {
      ...base.accessControl,
      ...overrides.accessControl,
      ownership:
        (overrides.accessControl?.ownership as RWAConfig['accessControl']['ownership']) ??
        base.accessControl.ownership,
      roles:
        (overrides.accessControl?.roles as RWAConfig['accessControl']['roles']) ??
        base.accessControl.roles,
    },
    deployment: {
      ...base.deployment,
      ...overrides.deployment,
    },
  };
}

export function createValidConfig(overrides: DeepPartial<RWAConfig> = {}): RWAConfig {
  return mergeConfig(
    {
      token: {
        name: 'Acme Real Estate Token',
        symbol: 'ACME',
        decimals: 18,
        initialSupply: '1000000000000000000000000',
        administrativeControls: { ...DEFAULT_ADMINISTRATIVE_CONTROLS },
        documentManager: { enabled: true },
      },
      identityVerification: {
        claimTopics: [
          { id: 1, name: 'KYC' },
          { id: 2, name: 'AML' },
        ],
        trustedIssuers: [
          {
            address: 'GCEXAMPLEISSUER1',
            claimTopics: [1, 2],
          },
        ],
        controls: { ...DEFAULT_IDENTITY_CONTROLS },
      },
      compliance: {
        modules: [],
      },
      accessControl: {
        ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
        roles: [
          { name: 'Manager', symbol: 'manager', addresses: ['GCEXAMPLEMGR'] },
          { name: 'Agent', symbol: 'agent', addresses: ['GCEXAMPLEAGNT'] },
        ],
      },
      deployment: {
        network: 'testnet',
      },
    },
    overrides
  );
}

export function createMinimalConfig(overrides: DeepPartial<RWAConfig> = {}): RWAConfig {
  return mergeConfig(
    {
      token: {
        name: 'Minimal Token',
        symbol: 'MIN',
        decimals: 7,
        administrativeControls: { ...DEFAULT_ADMINISTRATIVE_CONTROLS },
        documentManager: { enabled: false },
      },
      identityVerification: {
        claimTopics: [{ id: 1, name: 'KYC' }],
        trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
        controls: { ...DEFAULT_IDENTITY_CONTROLS },
      },
      compliance: {
        modules: [],
      },
      accessControl: {
        ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
        roles: [],
      },
      deployment: {
        network: 'testnet',
      },
    },
    overrides
  );
}
