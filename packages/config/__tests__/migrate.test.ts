import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '../src/types';
import { migrateRwaConfig } from '../src/migrate';

function createTestConfig(): RWAConfig {
  return {
    token: {
      name: 'Test',
      symbol: 'TST',
      decimals: 7,
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
      ownership: { type: 'single-owner', ownerAddress: 'GTEST' },
      roles: [],
    },
    deployment: {
      target: {
        kind: 'preset',
        ecosystem: 'stellar',
        networkId: 'stellar-testnet',
      },
    },
  };
}

describe('migrateRwaConfig', () => {
  it('renames transfer-restrict to transfer-allow', () => {
    const config = createTestConfig();
    config.compliance.modules = [{ moduleId: 'transfer-restrict' }];

    const migrated = migrateRwaConfig(config);

    expect(migrated.compliance.modules).toEqual([{ moduleId: 'transfer-allow' }]);
    expect(config.compliance.modules[0].moduleId).toBe('transfer-restrict');
  });

  it('preserves empty module config during migration', () => {
    const config = createTestConfig();
    config.compliance.modules = [{ moduleId: 'transfer-restrict', config: {} }];

    const migrated = migrateRwaConfig(config);

    expect(migrated.compliance.modules).toEqual([{ moduleId: 'transfer-allow', config: {} }]);
  });

  it('returns the same object when no migrations apply', () => {
    const config = createTestConfig();
    config.compliance.modules = [{ moduleId: 'supply-limit', config: { limit: 100 } }];

    expect(migrateRwaConfig(config)).toBe(config);
  });
});
