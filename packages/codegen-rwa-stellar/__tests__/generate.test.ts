import { describe, expect, it } from 'vitest';

import { createValidConfig } from './helpers/config';
import { CRATE_NAMES } from '../src/constants';
import { StellarRwaGenerator } from '../src/stellar-rwa-generator';

describe('StellarRwaGenerator', () => {
  const generator = new StellarRwaGenerator();

  describe('generator metadata', () => {
    it('should have correct name and version', () => {
      expect(generator.name).toBe('codegen-rwa-stellar');
      expect(generator.version).toBeDefined();
    });
  });

  describe('generate()', () => {
    it('should return a GenerationResult with files and metadata', () => {
      const config = createValidConfig();
      const result = generator.generate(config);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.generatorName).toBe('codegen-rwa-stellar');
      expect(result.metadata.generatedAt).toBeDefined();
      expect(result.metadata.fileCount).toBeGreaterThan(0);
      expect(result.metadata.configHash).toBeDefined();
    });

    it('should produce all 5 core contracts', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const paths = Object.keys(result.files);

      const expectedContracts = [
        CRATE_NAMES.rwaTtoken,
        CRATE_NAMES.compliance,
        CRATE_NAMES.identityVerifier,
        CRATE_NAMES.claimTopicsIssuers,
        CRATE_NAMES.identityRegistryStorage,
      ];

      for (const contractName of expectedContracts) {
        const contractRsPath = `contracts/${contractName}/src/contract.rs`;
        const libRsPath = `contracts/${contractName}/src/lib.rs`;
        const cargoTomlPath = `contracts/${contractName}/Cargo.toml`;

        expect(paths).toContain(contractRsPath);
        expect(paths).toContain(libRsPath);
        expect(paths).toContain(cargoTomlPath);
      }
    });

    it('should produce workspace Cargo.toml', () => {
      const config = createValidConfig();
      const result = generator.generate(config);

      expect(result.files).toHaveProperty('Cargo.toml');
      const cargoToml = result.files['Cargo.toml'] as string;
      expect(cargoToml).toContain('[workspace]');
      expect(cargoToml).toContain('resolver = "2"');
    });

    it('should include correct file paths per quickstart layout', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const paths = Object.keys(result.files);

      expect(paths).toContain('Cargo.toml');
      expect(paths).toContain('rustfmt.toml');
      expect(paths).toContain('README.md');
      expect(paths).toContain('config.json');
      expect(paths).toContain('scripts/build.sh');
      expect(paths).toContain('scripts/deploy.sh');
      expect(paths).toContain('contracts/rwa-token/src/contract.rs');
      expect(paths).toContain('contracts/rwa-token/src/lib.rs');
      expect(paths).toContain('contracts/rwa-token/Cargo.toml');
      expect(paths).toContain('contracts/compliance/src/contract.rs');
      expect(paths).toContain('contracts/identity-verifier/src/contract.rs');
      expect(paths).toContain('contracts/claim-topics-issuers/src/contract.rs');
      expect(paths).toContain('contracts/identity-registry-storage/src/contract.rs');
    });

    it('should produce rustfmt.toml with edition 2021 per SR-018', () => {
      const config = createValidConfig();
      const result = generator.generate(config);

      expect(result.files).toHaveProperty('rustfmt.toml');
      const rustfmtToml = result.files['rustfmt.toml'] as string;
      expect(rustfmtToml).toContain('edition = "2021"');
    });

    it('should produce lib.rs with #![no_std] for each contract', () => {
      const config = createValidConfig();
      const result = generator.generate(config);

      const libRsPath = 'contracts/rwa-token/src/lib.rs';
      const libRs = result.files[libRsPath] as string;

      expect(libRs).toContain('#![no_std]');
      expect(libRs).toContain('mod contract;');
      expect(libRs).toContain('pub use contract::*;');
    });
  });

  describe('trait implementations per SR-002', () => {
    const config = createValidConfig();
    const result = generator.generate(config);

    it('RWA Token should implement FungibleToken, AccessControl, Pausable', () => {
      const contract = result.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(contract).toContain('impl FungibleToken for RWATokenContract');
      expect(contract).toContain('type ContractType = RWA;');
      expect(contract).toContain('impl AccessControl for RWATokenContract');
      expect(contract).toContain('impl Pausable for RWATokenContract');
    });

    it('RWA Token should include DocumentManager when enabled', () => {
      const contract = result.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(contract).toContain('impl DocumentManager for RWATokenContract');
    });

    it('Compliance should implement Compliance, TokenBinder, AccessControl', () => {
      const contract = result.files['contracts/compliance/src/contract.rs'] as string;

      expect(contract).toContain('impl Compliance for ComplianceContract');
      expect(contract).toContain('impl TokenBinder for ComplianceContract');
      expect(contract).toContain('impl AccessControl for ComplianceContract');
    });

    it('Identity Verifier should implement IdentityVerifier, AccessControl', () => {
      const contract = result.files['contracts/identity-verifier/src/contract.rs'] as string;

      expect(contract).toContain('impl IdentityVerifier for IdentityVerifierContract');
      expect(contract).toContain('impl AccessControl for IdentityVerifierContract');
    });

    it('CTI should implement ClaimTopicsAndIssuers, AccessControl', () => {
      const contract = result.files['contracts/claim-topics-issuers/src/contract.rs'] as string;

      expect(contract).toContain('impl ClaimTopicsAndIssuers for ClaimTopicsAndIssuersContract');
      expect(contract).toContain('impl AccessControl for ClaimTopicsAndIssuersContract');
    });

    it('IRS should implement IdentityRegistryStorage, CountryDataManager, and TokenBinder', () => {
      const contract = result.files[
        'contracts/identity-registry-storage/src/contract.rs'
      ] as string;

      expect(contract).toContain('impl IdentityRegistryStorage for IdentityRegistryContract');
      expect(contract).toContain('impl CountryDataManager for IdentityRegistryContract');
      expect(contract).toContain('impl TokenBinder for IdentityRegistryContract');
    });
  });

  describe('constructor args per SR-016', () => {
    const config = createValidConfig();
    const result = generator.generate(config);

    it('RWA Token: e, name, symbol, admin, manager, compliance, identity_verifier', () => {
      const contract = result.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(contract).toContain('pub fn __constructor(');
      expect(contract).toContain('e: &Env,');
      expect(contract).toContain('name: String,');
      expect(contract).toContain('symbol: String,');
      expect(contract).toContain('admin: Address,');
      expect(contract).toContain('manager: Address,');
      expect(contract).toContain('compliance: Address,');
      expect(contract).toContain('identity_verifier: Address,');
      expect(contract).not.toContain('initial_supply: i128,');
    });

    it('Compliance: e, admin, manager', () => {
      const contract = result.files['contracts/compliance/src/contract.rs'] as string;

      expect(contract).toContain('pub fn __constructor(e: &Env, admin: Address, manager: Address)');
    });

    it('Identity Verifier: e, admin, manager, identity_registry_storage, claim_topics_and_issuers', () => {
      const contract = result.files['contracts/identity-verifier/src/contract.rs'] as string;

      expect(contract).toContain('admin: Address,');
      expect(contract).toContain('manager: Address,');
      expect(contract).toContain('identity_registry_storage: Address,');
      expect(contract).toContain('claim_topics_and_issuers: Address,');
    });

    it('CTI: e, admin, manager', () => {
      const contract = result.files['contracts/claim-topics-issuers/src/contract.rs'] as string;

      expect(contract).toContain(
        'pub fn __constructor(e: &Env, admin: Address, manager: Address)'
      );
    });

    it('IRS: e, admin, manager', () => {
      const contract = result.files[
        'contracts/identity-registry-storage/src/contract.rs'
      ] as string;

      expect(contract).toContain(
        'pub fn __constructor(e: &Env, admin: Address, manager: Address)'
      );
    });
  });

  describe('metadata', () => {
    it('should produce deterministic configHash for same config', () => {
      const config = createValidConfig();
      const result1 = generator.generate(config);
      const result2 = generator.generate(config);

      expect(result1.metadata.configHash).toBe(result2.metadata.configHash);
    });

    it('should produce different configHash for different configs', () => {
      const config1 = createValidConfig();
      const config2 = createValidConfig({
        token: {
          name: 'Different Token',
          symbol: 'DIFF',
          decimals: 8,
          documentManager: { enabled: false },
        },
      });

      const result1 = generator.generate(config1);
      const result2 = generator.generate(config2);

      expect(result1.metadata.configHash).not.toBe(result2.metadata.configHash);
    });

    it('should count correct number of files', () => {
      const config = createValidConfig();
      const result = generator.generate(config);

      expect(result.metadata.fileCount).toBe(Object.keys(result.files).length);
    });
  });

  describe('scripts, config.json, and README (US2)', () => {
    it('should produce build.sh with stellar contract build', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const buildSh = result.files['scripts/build.sh'] as string;

      expect(buildSh).toContain('#!/bin/bash');
      expect(buildSh).toContain('stellar contract build');
    });

    it('should produce deploy.sh with correct deployment order', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const deploySh = result.files['scripts/deploy.sh'] as string;

      expect(deploySh).toContain('#!/bin/bash');
      const ctiPos = deploySh.indexOf('CTI_ADDRESS=$(');
      const irsPos = deploySh.indexOf('IRS_ADDRESS=$(');
      const tokenPos = deploySh.indexOf('RWA_TOKEN_ADDRESS=$(');

      expect(ctiPos).toBeLessThan(irsPos);
      expect(irsPos).toBeLessThan(tokenPos);
    });

    it('should produce config.json mirroring RWAConfig structure per SR-007', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const configJson = JSON.parse(result.files['config.json'] as string);

      expect(configJson).toHaveProperty('token');
      expect(configJson).toHaveProperty('identityVerification');
      expect(configJson).toHaveProperty('compliance');
      expect(configJson).toHaveProperty('accessControl');
      expect(configJson).toHaveProperty('deployment');
      expect(configJson.token.name).toBe('Acme Real Estate Token');
      expect(configJson.token.symbol).toBe('ACME');
    });

    it('should produce README.md with required sections per SR-009', () => {
      const config = createValidConfig();
      const result = generator.generate(config);
      const readme = result.files['README.md'] as string;

      expect(readme).toContain('Acme Real Estate Token');
      expect(readme).toContain('Prerequisites');
      expect(readme).toContain('Build');
      expect(readme).toContain('Deploy');
      expect(readme).toContain('Architecture');
      expect(readme).toContain('Contracts');
      expect(readme).toContain('Unix');
    });
  });

  describe('progress callbacks (US8)', () => {
    it('should invoke callback with sequential phases and increasing percentages', () => {
      const config = createValidConfig();
      const events: Array<{ phase: string; percentage: number }> = [];

      generator.generate(config, {
        onProgress: (event) => events.push({ phase: event.phase, percentage: event.percentage }),
      });

      expect(events.length).toBeGreaterThanOrEqual(3);

      const phases = events.map((e) => e.phase);
      expect(phases).toContain('validating');
      expect(phases).toContain('generating-contracts');
      expect(phases).toContain('generating-scripts');

      const validatingIdx = phases.indexOf('validating');
      const contractsIdx = phases.indexOf('generating-contracts');
      const scriptsIdx = phases.indexOf('generating-scripts');
      expect(validatingIdx).toBeLessThan(contractsIdx);
      expect(contractsIdx).toBeLessThan(scriptsIdx);

      for (let i = 1; i < events.length; i++) {
        expect(events[i].percentage).toBeGreaterThanOrEqual(events[i - 1].percentage);
      }

      expect(events[0].percentage).toBeGreaterThanOrEqual(0);
      expect(events[events.length - 1].percentage).toBe(100);
    });

    it('should not error when no callback is provided', () => {
      const config = createValidConfig();
      expect(() => generator.generate(config)).not.toThrow();
      expect(() => generator.generate(config, {})).not.toThrow();
      expect(() => generator.generate(config, { onProgress: undefined })).not.toThrow();
    });

    it('should report generating-contracts before generating-scripts', () => {
      const config = createValidConfig();
      const phases: string[] = [];

      generator.generate(config, {
        onProgress: (event) => phases.push(event.phase),
      });

      const contractsIdx = phases.indexOf('generating-contracts');
      const scriptsIdx = phases.indexOf('generating-scripts');

      expect(contractsIdx).toBeGreaterThan(-1);
      expect(scriptsIdx).toBeGreaterThan(-1);
      expect(contractsIdx).toBeLessThan(scriptsIdx);
    });

    it('should include a complete phase at 100%', () => {
      const config = createValidConfig();
      const events: Array<{ phase: string; percentage: number }> = [];

      generator.generate(config, {
        onProgress: (event) => events.push({ phase: event.phase, percentage: event.percentage }),
      });

      const last = events[events.length - 1];
      expect(last.phase).toBe('complete');
      expect(last.percentage).toBe(100);
    });

    it('should work with compliance modules and still report progress', () => {
      const config = createValidConfig({
        compliance: {
          modules: [
            {
              moduleId: 'supply-limit',
              config: { limit: 1000000 },
            },
          ],
        },
      });

      const phases: string[] = [];
      generator.generate(config, {
        onProgress: (event) => phases.push(event.phase),
        allowUnderReviewModules: true,
      });

      expect(phases).toContain('validating');
      expect(phases).toContain('generating-contracts');
      expect(phases).toContain('generating-scripts');
      expect(phases).toContain('complete');
    });
  });

  describe('edge cases', () => {
    it('should generate valid output with no roles', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
          roles: [],
        },
      });

      const result = generator.generate(config);
      const tokenContract = result.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(tokenContract).toContain('grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);');
      expect(result.metadata.fileCount).toBeGreaterThan(0);
    });

    it('should generate valid output with DocumentManager disabled', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });

      const result = generator.generate(config);
      const tokenContract = result.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(tokenContract).not.toContain('DocumentManager');
    });

    it('should generate valid output with zero claim topics', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [],
          trustedIssuers: [],
        },
      });

      const result = generator.generate(config);
      expect(result.metadata.fileCount).toBeGreaterThan(0);
    });

    it('should generate valid output with multi-sig ownership', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: 'GCMULTISIG' },
          roles: [],
        },
      });

      const result = generator.generate(config);
      expect(result.metadata.fileCount).toBeGreaterThan(0);
    });
  });
});
