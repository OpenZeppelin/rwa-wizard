import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CRATE_NAMES } from '../../src/constants';
import { generateBuildSh } from '../../src/templates/scripts/build-sh';
import { generateDeploySh } from '../../src/templates/scripts/deploy-sh';

function createValidConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return {
    token: {
      name: 'Acme Real Estate Token',
      symbol: 'ACME',
      decimals: 18,
      initialSupply: '1000000000000000000000000',
      documentManager: { enabled: true },
      ...overrides.token,
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
      ...overrides.identityVerification,
    },
    compliance: {
      modules: [],
      ...overrides.compliance,
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [
        { name: 'Manager', symbol: 'manager', addresses: ['GCEXAMPLEMGR'] },
        { name: 'Agent', symbol: 'agent', addresses: ['GCEXAMPLEAGNT'] },
      ],
      ...overrides.accessControl,
    },
    deployment: {
      network: 'testnet',
      ...overrides.deployment,
    },
  };
}

describe('build.sh template', () => {
  it('should be a bash script with shebang', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toMatch(/^#!/);
    expect(script).toContain('#!/bin/bash');
  });

  it('should set -e for exit on error', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toContain('set -e');
  });

  it('should build all workspace contracts using stellar contract build', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toContain('stellar contract build');
  });

  it('should be executable (include a shebang line)', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script.startsWith('#!/bin/bash')).toBe(true);
  });
});

describe('deploy.sh template', () => {
  describe('deployment order per SR-006', () => {
    it('should deploy contracts in correct dependency order: CTI → IRS → Identity Verifier → Compliance → RWA Token', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const ctiPos = script.indexOf(CRATE_NAMES.claimTopicsIssuers);
      const irsPos = script.indexOf(CRATE_NAMES.identityRegistryStorage);
      const ivPos = script.indexOf(CRATE_NAMES.identityVerifier);
      const compPos = script.indexOf(CRATE_NAMES.compliance);
      const tokenPos = script.indexOf(CRATE_NAMES.rwaTtoken);

      expect(ctiPos).toBeLessThan(irsPos);
      expect(irsPos).toBeLessThan(ivPos);
      expect(ivPos).toBeLessThan(compPos);
      expect(compPos).toBeLessThan(tokenPos);
    });

    it('should deploy modules after Compliance and before RWA Token when modules are present', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      const compDeployPos = script.indexOf('COMPLIANCE_ADDRESS=$(');
      const moduleDeployPos = script.indexOf('MODULE_SUPPLY_LIMIT_ADDRESS=$(');
      const tokenDeployPos = script.indexOf('RWA_TOKEN_ADDRESS=$(');

      expect(compDeployPos).toBeGreaterThan(-1);
      expect(moduleDeployPos).toBeGreaterThan(-1);
      expect(tokenDeployPos).toBeGreaterThan(-1);
      expect(compDeployPos).toBeLessThan(moduleDeployPos);
      expect(moduleDeployPos).toBeLessThan(tokenDeployPos);
    });
  });

  describe('address capture threading', () => {
    it('should capture deployed addresses into shell variables', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toMatch(/CTI_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/IRS_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/IDENTITY_VERIFIER_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/COMPLIANCE_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/RWA_TOKEN_ADDRESS=.*stellar contract deploy/s);
    });

    it('should thread CTI address into Identity Verifier deployment', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const ivSection = extractDeploySection(script, 'IDENTITY_VERIFIER_ADDRESS');
      expect(ivSection).toContain('$CTI_ADDRESS');
    });
  });

  describe('error handling (exit code checks)', () => {
    it('should be a bash script with set -e', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('set -e');
    });

    it('should check exit codes after deployments', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('$?');
    });

    it('should abort with descriptive messages on deployment failure', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('Failed to deploy');
    });
  });

  describe('post-deploy configuration per SR-013', () => {
    it('should bind token on Compliance contract', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('bind_token');
      expect(script).toContain('$COMPLIANCE_ADDRESS');
      expect(script).toContain('$RWA_TOKEN_ADDRESS');
    });

    it('should bind token on IRS contract', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const bindSections = script.split('bind_token');
      expect(bindSections.length).toBeGreaterThanOrEqual(3);
    });

    it('should add claim topics from config', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [
            { id: 1, name: 'KYC' },
            { id: 2, name: 'AML' },
            { id: 3, name: 'Accreditation' },
          ],
          trustedIssuers: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_claim_topic');
      expect(script).toContain('$CTI_ADDRESS');
    });

    it('should add trusted issuers from config', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [
            {
              address: 'GCISSUER1',
              claimTopics: [1],
            },
          ],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_trusted_issuer');
    });

    it('should register modules on Compliance when modules are selected', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_module_to');
    });

    it('should have correct post-deploy order: bind token → register modules → add claim topics → add trusted issuers → optional mint', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      const bindPos = script.indexOf('bind_token');
      const modulePos = script.indexOf('add_module_to');
      const claimTopicPos = script.indexOf('add_claim_topic');
      const issuerPos = script.indexOf('add_trusted_issuer');
      const mintPos = script.indexOf('mint');

      expect(bindPos).toBeLessThan(modulePos);
      expect(modulePos).toBeLessThan(claimTopicPos);
      expect(claimTopicPos).toBeLessThan(issuerPos);
      expect(issuerPos).toBeLessThan(mintPos);
    });
  });

  describe('conditional mint call', () => {
    it('should include mint call when initialSupply is defined', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '1000000',
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('mint');
    });

    it('should include mint call with amount when initialSupply is "0"', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '0',
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('mint');
    });

    it('should omit mint call when initialSupply is undefined', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: undefined,
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      const postDeploySection = script.slice(script.lastIndexOf('# Post-deploy'));
      expect(postDeploySection).not.toContain('mint');
    });
  });

  describe('network configuration', () => {
    it('should use testnet network from config', () => {
      const config = createValidConfig({ deployment: { network: 'testnet' } });
      const script = generateDeploySh(config);

      expect(script).toContain('testnet');
    });

    it('should use custom network URL when provided', () => {
      const config = createValidConfig({
        deployment: { network: 'https://custom-rpc.example.com' },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('https://custom-rpc.example.com');
    });
  });

  describe('admin address', () => {
    it('should use single-owner address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNERADDR' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCOWNERADDR');
    });

    it('should use multi-sig address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: 'GCMULTISIG' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCMULTISIG');
    });

    it('should use DAO address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'dao', address: 'GCDAOADDR' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCDAOADDR');
    });
  });

  describe('empty config edge cases', () => {
    it('should handle zero claim topics and zero trusted issuers', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [],
          trustedIssuers: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('add_claim_topic');
      expect(script).not.toContain('add_trusted_issuer');
    });

    it('should handle no compliance modules', () => {
      const config = createValidConfig({
        compliance: { modules: [] },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('add_module_to');
    });
  });
});

function extractDeploySection(script: string, variableName: string): string {
  const start = script.indexOf(`${variableName}=`);
  if (start === -1) return '';
  const end = script.indexOf('\n\n', start);
  return script.slice(start, end === -1 ? undefined : end);
}
