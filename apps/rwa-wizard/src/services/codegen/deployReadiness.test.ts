import { describe, expect, it } from 'vitest';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { getDeployGuidanceFromService, resolveIncludeIdentitySupport } from './deployReadiness';
import type { DeployGuidanceDTO, RwaCodegenService } from './types';

const testnetGuidance: DeployGuidanceDTO = {
  adminAddress: 'GADMIN',
  managerAddress: 'GMGR',
  adminEqualsManager: false,
  networkDisplayName: 'Testnet',
  networkIsTestnet: true,
  demoAutoMintEligible: true,
  demoMintComplianceIssues: [],
};

describe('deployReadiness', () => {
  it('returns null when the codegen service does not expose deploy guidance', () => {
    const service = {} as RwaCodegenService;
    expect(getDeployGuidanceFromService(service, makeConfig())).toBeNull();
  });

  it('returns guidance from the codegen service boundary', () => {
    const service: RwaCodegenService = {
      validate: async () => ({ valid: true, errors: [], warnings: [] }),
      getAvailableModules: async () => [],
      generateZip: async () => ({ fileName: 'x.zip', data: new Blob() }),
      generateFileTree: async () => ({ files: { 'README.md': '# x\n' } }),
      getDeployGuidance: () => testnetGuidance,
    };

    expect(getDeployGuidanceFromService(service, makeConfig())).toEqual(testnetGuidance);
  });

  it('passes identity scaffolding only for testnet guidance', () => {
    expect(resolveIncludeIdentitySupport(testnetGuidance, true)).toBe(true);
    expect(
      resolveIncludeIdentitySupport({ ...testnetGuidance, networkIsTestnet: false }, true)
    ).toBe(false);
    expect(resolveIncludeIdentitySupport(null, true)).toBe(false);
    expect(resolveIncludeIdentitySupport(testnetGuidance, false)).toBe(false);
  });
});
