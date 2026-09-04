import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import type { AddressingCapability } from '@openzeppelin/ui-types';

import type { ComplianceModuleOption } from '../../../types/wizard';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { getIdentityStepIssues, isStepValid } from './stepValidators';

const stellarAddressing: AddressingCapability = {
  isValidAddress: (addr) => /^G[A-Z0-9]{55}$/.test(addr) || /^C[A-Z0-9]{55}$/.test(addr),
};

const VALID_STELLAR_ADDRESS = 'G' + 'A'.repeat(55);
const INVALID_ADDRESS = 'not-an-address';

function baseConfig(overrides: (cfg: RWAConfig) => void = () => undefined): RWAConfig {
  const cfg = createDefaultRwaConfig();
  cfg.token.name = 'My Token';
  cfg.token.symbol = 'MYT';
  if (cfg.accessControl.ownership.type === 'single-owner') {
    cfg.accessControl.ownership.ownerAddress = VALID_STELLAR_ADDRESS;
  }
  overrides(cfg);
  return cfg;
}

describe('isStepValid', () => {
  // -------------------------------------------------------------------------
  // asset
  // -------------------------------------------------------------------------

  describe('asset', () => {
    it('is valid for a well-formed token', () => {
      expect(isStepValid('asset', baseConfig())).toBe(true);
    });

    it('rejects an empty token name', () => {
      const cfg = baseConfig((c) => {
        c.token.name = '';
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('rejects a whitespace-only token name', () => {
      const cfg = baseConfig((c) => {
        c.token.name = '   ';
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('rejects token name longer than 32 characters', () => {
      const cfg = baseConfig((c) => {
        c.token.name = 'x'.repeat(33);
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('accepts token name of exactly 32 characters', () => {
      const cfg = baseConfig((c) => {
        c.token.name = 'x'.repeat(32);
      });
      expect(isStepValid('asset', cfg)).toBe(true);
    });

    it('rejects token symbol longer than 12 characters', () => {
      const cfg = baseConfig((c) => {
        c.token.symbol = 'SSSSSSSSSSSSS'; // 13
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('rejects empty token symbol', () => {
      const cfg = baseConfig((c) => {
        c.token.symbol = '';
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('rejects decimals out of range', () => {
      const below = baseConfig((c) => {
        c.token.decimals = -1;
      });
      const above = baseConfig((c) => {
        c.token.decimals = 19;
      });
      expect(isStepValid('asset', below)).toBe(false);
      expect(isStepValid('asset', above)).toBe(false);
    });

    it('rejects non-integer decimals', () => {
      const cfg = baseConfig((c) => {
        c.token.decimals = 7.5;
      });
      expect(isStepValid('asset', cfg)).toBe(false);
    });

    it('accepts an empty optional initial supply', () => {
      const cfg = baseConfig((c) => {
        c.token.initialSupply = '';
      });
      expect(isStepValid('asset', cfg)).toBe(true);
    });

    it('rejects an initial supply that is not a non-negative integer string', () => {
      const cfg = baseConfig((c) => {
        c.token.initialSupply = '1.5';
      });
      expect(isStepValid('asset', cfg)).toBe(false);

      const cfg2 = baseConfig((c) => {
        c.token.initialSupply = '-10';
      });
      expect(isStepValid('asset', cfg2)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // identity
  // -------------------------------------------------------------------------

  describe('identity', () => {
    it('is valid with no trusted issuers', () => {
      expect(isStepValid('identity', baseConfig())).toBe(true);
    });

    it('is valid when all trusted issuer addresses pass the adapter check', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(true);
    });

    it('rejects config with a stale invalid trusted issuer address', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [{ address: INVALID_ADDRESS, claimTopics: [1] }];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);
    });

    it('rejects an empty trusted issuer address even without an addressing adapter', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [{ address: '   ', claimTopics: [1] }];
      });
      expect(isStepValid('identity', cfg)).toBe(false);
    });

    it('degrades address format to pass-through when no addressing adapter is available', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [{ address: INVALID_ADDRESS, claimTopics: [1] }];
      });
      expect(isStepValid('identity', cfg)).toBe(true);
    });

    it('rejects an issuer that references only unselected claim topics (UNSELECTED_REFERENCE)', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [
          { id: 1, name: 'KYC', selected: false },
          { id: 2, name: 'AML', selected: false },
        ];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1, 2] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);
    });

    it('accepts that issuer again once one referenced topic is selected', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [
          { id: 1, name: 'KYC', selected: false },
          { id: 2, name: 'AML', selected: false },
        ];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1, 2] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);

      cfg.identityVerification.claimTopics[0] = { id: 1, name: 'KYC' };
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(true);
    });

    it('accepts again when the unselected-only issuer is removed', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC', selected: false }];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);

      cfg.identityVerification.trustedIssuers = [];
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(true);
    });

    it('surfaces the unselected-topics notice id for UNSELECTED_REFERENCE', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC', selected: false }];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1] },
        ];
      });
      expect(getIdentityStepIssues(cfg.identityVerification)).toEqual([
        'trusted-issuer.unselected-topics',
      ]);
    });

    it('rejects an issuer that references a claim-topic id absent from claimTopics', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [1, 99] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);
    });

    it('surfaces the unknown-topics notice id for INVALID_REFERENCE (orphan topic id)', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.claimTopics = [{ id: 1, name: 'KYC' }];
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [99] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);
      expect(getIdentityStepIssues(cfg.identityVerification)).toEqual([
        'trusted-issuer.unknown-topics',
      ]);
    });

    it('rejects an issuer with no claim-topic references', () => {
      const cfg = baseConfig((c) => {
        c.identityVerification.trustedIssuers = [
          { address: VALID_STELLAR_ADDRESS, claimTopics: [] },
        ];
      });
      expect(isStepValid('identity', cfg, { addressing: stellarAddressing })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // compliance
  // -------------------------------------------------------------------------

  describe('compliance', () => {
    const jurisdictionModule: ComplianceModuleOption = {
      id: 'country-allowlist',
      name: 'Country Allowlist',
      category: 'jurisdiction',
      runtimePrerequisites: [],
      description: '',
      requiredHooks: [],
      review: { state: 'stable' },
      configFields: [
        { key: 'allowedCountries', label: 'Allowed', type: 'string[]', required: true },
      ],
    };

    it('is valid when no modules are selected', () => {
      expect(isStepValid('compliance', baseConfig())).toBe(true);
    });

    it('rejects a selected module that is missing a required config field', () => {
      const cfg = baseConfig((c) => {
        c.compliance.modules = [{ moduleId: 'country-allowlist' }];
      });
      expect(isStepValid('compliance', cfg, { availableModules: [jurisdictionModule] })).toBe(
        false
      );
    });

    it('rejects a required string[] field that is an empty array', () => {
      const cfg = baseConfig((c) => {
        c.compliance.modules = [
          { moduleId: 'country-allowlist', config: { allowedCountries: [] } },
        ];
      });
      expect(isStepValid('compliance', cfg, { availableModules: [jurisdictionModule] })).toBe(
        false
      );
    });

    it('accepts a selected module once all required fields are populated', () => {
      const cfg = baseConfig((c) => {
        c.compliance.modules = [
          { moduleId: 'country-allowlist', config: { allowedCountries: ['US'] } },
        ];
      });
      expect(isStepValid('compliance', cfg, { availableModules: [jurisdictionModule] })).toBe(true);
    });

    it('degrades to pass-through when no module catalog is available yet', () => {
      const cfg = baseConfig((c) => {
        c.compliance.modules = [{ moduleId: 'country-allowlist' }];
      });
      expect(isStepValid('compliance', cfg)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // access-control
  // -------------------------------------------------------------------------

  describe('access-control', () => {
    it('rejects empty single-owner address', () => {
      const cfg = baseConfig((c) => {
        c.accessControl.ownership = { type: 'single-owner', ownerAddress: '' };
      });
      expect(isStepValid('access-control', cfg)).toBe(false);
    });

    it('rejects an invalid single-owner address under the adapter', () => {
      const cfg = baseConfig((c) => {
        c.accessControl.ownership = { type: 'single-owner', ownerAddress: INVALID_ADDRESS };
      });
      expect(isStepValid('access-control', cfg, { addressing: stellarAddressing })).toBe(false);
    });

    it('accepts a valid single-owner address under the adapter', () => {
      const cfg = baseConfig();
      expect(isStepValid('access-control', cfg, { addressing: stellarAddressing })).toBe(true);
    });

    it('rejects empty multi-sig / dao address', () => {
      const cfg = baseConfig((c) => {
        c.accessControl.ownership = { type: 'multi-sig', address: '' };
      });
      expect(isStepValid('access-control', cfg)).toBe(false);

      const dao = baseConfig((c) => {
        c.accessControl.ownership = { type: 'dao', address: '' };
      });
      expect(isStepValid('access-control', dao)).toBe(false);
    });

    it('accepts a valid multi-sig address under the adapter', () => {
      const cfg = baseConfig((c) => {
        c.accessControl.ownership = { type: 'multi-sig', address: VALID_STELLAR_ADDRESS };
      });
      expect(isStepValid('access-control', cfg, { addressing: stellarAddressing })).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // review / deployment (always-valid terminal steps)
  // -------------------------------------------------------------------------

  it('review is always valid (generation has its own gating)', () => {
    expect(isStepValid('review', baseConfig())).toBe(true);
  });

  it('deployment is always valid (placeholder step)', () => {
    expect(isStepValid('deployment', baseConfig())).toBe(true);
  });
});
