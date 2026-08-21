import { describe, expect, it } from 'vitest';

import { STELLAR_VALIDATION_CONSTANTS } from '@openzeppelin/codegen-rwa-stellar';

import { stellarAdapter } from '../src/generators/stellar';
import { createValidConfig } from './helpers';

describe('Stellar Adapter', () => {
  it('should identify as stellar chain', () => {
    expect(stellarAdapter.chain).toBe('stellar');
    expect(stellarAdapter.name).toBe('Stellar/Soroban RWA Generator');
  });

  describe('hints', () => {
    it('should mirror STELLAR_VALIDATION_CONSTANTS for token limits', () => {
      const { hints } = stellarAdapter;
      expect(hints.tokenNameMaxLength).toBe(STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH);
      expect(hints.tokenSymbolMaxLength).toBe(STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH);
      expect(hints.decimalsMin).toBe(STELLAR_VALIDATION_CONSTANTS.DECIMALS_MIN);
      expect(hints.decimalsMax).toBe(STELLAR_VALIDATION_CONSTANTS.DECIMALS_MAX);
    });

    it('should mirror STELLAR_VALIDATION_CONSTANTS for role symbol length', () => {
      expect(stellarAdapter.hints.roleSymbolMaxLength).toBe(
        STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH
      );
    });

    it('should provide testnet and mainnet network options', () => {
      const { networks } = stellarAdapter.hints;
      expect(networks.length).toBeGreaterThanOrEqual(2);
      expect(networks.find((n) => n.value === 'stellar-testnet')).toBeDefined();
      expect(networks.find((n) => n.value === 'stellar-mainnet')).toBeDefined();
    });

    it('should include an address placeholder', () => {
      expect(stellarAdapter.hints.addressPlaceholder).toBeTruthy();
    });
  });

  describe('validate', () => {
    it('should accept a valid config', () => {
      const result = stellarAdapter.validate(createValidConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a config with an empty token name', () => {
      const config = createValidConfig();
      config.token.name = '';
      const result = stellarAdapter.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generate', () => {
    it('should produce files from a valid config', () => {
      const result = stellarAdapter.generate(createValidConfig());
      expect(Object.keys(result.files).length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    it('should include metadata with generator name', () => {
      const result = stellarAdapter.generate(createValidConfig());
      expect(result.metadata.generatorName).toBeTruthy();
      expect(result.metadata.configHash).toBeTruthy();
    });
  });

  describe('generateZip', () => {
    it('should produce a ZIP blob', async () => {
      const result = await stellarAdapter.generateZip(createValidConfig());
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.fileName).toContain('.zip');
      expect(result.metadata.fileCount).toBeGreaterThan(0);
    });
  });

  describe('getAvailableModules', () => {
    it('should return an array of compliance module descriptors', () => {
      const modules = stellarAdapter.getAvailableModules();
      expect(Array.isArray(modules)).toBe(true);
      for (const m of modules) {
        expect(m).toHaveProperty('id');
        expect(m).toHaveProperty('name');
        // `description` is intentionally not asserted: ComplianceModuleRegistryEntry
        // does not carry one, so this previously passed only because the key existed
        // with an undefined value -- which is what made the CLI print "undefined".
        expect(typeof m.name).toBe('string');
        expect(m).toHaveProperty('requiredHooks');
        expect(Array.isArray(m.requiredHooks)).toBe(true);
        expect(m).toHaveProperty('review');
        expect(m.review).toHaveProperty('state');
        expect(m).toHaveProperty('configFields');
        expect(Array.isArray(m.configFields)).toBe(true);
      }
    });

    it('should expose transfer-allow instead of transfer-restrict', () => {
      const modules = stellarAdapter.getAvailableModules();
      expect(modules.some((m) => m.id === 'transfer-allow')).toBe(true);
      expect(modules.some((m) => m.id === 'transfer-restrict')).toBe(false);
    });
  });

  describe('getOperatorRolePresets', () => {
    it('should include manager as the first preset', () => {
      const presets = stellarAdapter.getOperatorRolePresets();
      expect(presets[0]?.id).toBe('manager');
      expect(presets[0]?.defaultSymbol).toBe('manager');
    });
  });

  describe('identity support generation', () => {
    it('should include identity-support artifacts when requested', () => {
      const result = stellarAdapter.generateWithIdentitySupport!(createValidConfig());
      expect(result.files['contracts/claim-issuer/src/contract.rs']).toBeDefined();
      expect(result.files['contracts/identity/src/contract.rs']).toBeDefined();
      expect(result.files['tools/sign-claim/src/main.rs']).toBeDefined();
    });

    it('should package identity-support artifacts in ZIP output', async () => {
      const zip = await stellarAdapter.generateZipWithIdentitySupport!(createValidConfig());
      expect(zip.data).toBeInstanceOf(Blob);
      expect(zip.fileName).toContain('.zip');
    });
  });
});
