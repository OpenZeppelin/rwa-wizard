import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  generate,
  generateRoleSymbol,
  generateZip,
  getAvailableModules,
  STELLAR_VALIDATION_CONSTANTS,
  StellarRwaGenerator,
  validate,
} from '../src/index';
import type {
  ComplianceModuleRegistryEntry,
  GenerationResult,
  ValidationResult,
  ZipResult,
} from '../src/index';

function createValidConfig(): RWAConfig {
  return {
    token: {
      name: 'Standalone Test Token',
      symbol: 'STST',
      decimals: 8,
      initialSupply: '10000000000',
      documentManager: { enabled: true },
    },
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
    },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] }],
    },
    deployment: { network: 'testnet' },
  };
}

/**
 * US4 — Standalone Node.js integration test (SC-004).
 *
 * Verifies that @openzeppelin/codegen-rwa-stellar works in a pure Node.js
 * environment with no browser globals, React, or UI framework dependencies.
 */
describe('standalone Node.js integration (US4)', () => {
  describe('environment verification', () => {
    it('should not depend on browser-only globals (window, document)', () => {
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');
    });

    it('should work without DOM APIs', () => {
      const config = createValidConfig();
      const result = generate(config);
      expect(Object.keys(result.files).length).toBeGreaterThan(0);
    });
  });

  describe('public API surface', () => {
    it('should export generate as a function', () => {
      expect(typeof generate).toBe('function');
    });

    it('should export validate as a function', () => {
      expect(typeof validate).toBe('function');
    });

    it('should export generateZip as a function', () => {
      expect(typeof generateZip).toBe('function');
    });

    it('should export getAvailableModules as a function', () => {
      expect(typeof getAvailableModules).toBe('function');
    });

    it('should export generateRoleSymbol as a function', () => {
      expect(typeof generateRoleSymbol).toBe('function');
    });

    it('should export STELLAR_VALIDATION_CONSTANTS as an object', () => {
      expect(typeof STELLAR_VALIDATION_CONSTANTS).toBe('object');
      expect(STELLAR_VALIDATION_CONSTANTS).toHaveProperty('TOKEN_NAME_MAX_LENGTH');
      expect(STELLAR_VALIDATION_CONSTANTS).toHaveProperty('TOKEN_SYMBOL_MAX_LENGTH');
      expect(STELLAR_VALIDATION_CONSTANTS).toHaveProperty('DECIMALS_MIN');
      expect(STELLAR_VALIDATION_CONSTANTS).toHaveProperty('DECIMALS_MAX');
      expect(STELLAR_VALIDATION_CONSTANTS).toHaveProperty('ROLE_SYMBOL_MAX_LENGTH');
    });

    it('should export StellarRwaGenerator class', () => {
      expect(typeof StellarRwaGenerator).toBe('function');
      const instance = new StellarRwaGenerator();
      expect(instance).toHaveProperty('name');
      expect(instance).toHaveProperty('version');
      expect(typeof instance.validate).toBe('function');
      expect(typeof instance.generate).toBe('function');
    });
  });

  describe('validate() in Node.js', () => {
    it('should return a valid result for a correct config', () => {
      const config = createValidConfig();
      const result: ValidationResult = validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return structured errors for an invalid config', () => {
      const config = createValidConfig();
      config.token.symbol = 'THIS_SYMBOL_IS_WAY_TOO_LONG';

      const result: ValidationResult = validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const symbolError = result.errors.find((e) => e.field === 'token.symbol');
      expect(symbolError).toBeDefined();
      expect(symbolError!.code).toBeDefined();
      expect(symbolError!.message).toBeDefined();
    });

    it('should never throw, even for severely malformed configs', () => {
      const malformed = {
        token: { name: '', symbol: '', decimals: -1, documentManager: { enabled: false } },
        identityVerification: { claimTopics: [], trustedIssuers: [] },
        compliance: { modules: [] },
        accessControl: {
          ownership: { type: 'single-owner' as const, ownerAddress: '' },
          roles: [],
        },
        deployment: { network: '' },
      } satisfies RWAConfig;

      expect(() => validate(malformed)).not.toThrow();
      const result = validate(malformed);
      expect(result.valid).toBe(false);
    });
  });

  describe('generate() in Node.js', () => {
    it('should produce a GenerationResult with files and metadata', () => {
      const config = createValidConfig();
      const result: GenerationResult = generate(config);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('metadata');
      expect(typeof result.files).toBe('object');
      expect(Object.keys(result.files).length).toBeGreaterThan(0);
    });

    it('should include metadata with all required fields', () => {
      const config = createValidConfig();
      const result = generate(config);

      expect(result.metadata.generatorName).toBe('codegen-rwa-stellar');
      expect(typeof result.metadata.generatorVersion).toBe('string');
      expect(typeof result.metadata.generatedAt).toBe('string');
      expect(typeof result.metadata.fileCount).toBe('number');
      expect(typeof result.metadata.configHash).toBe('string');
      expect(result.metadata.fileCount).toBe(Object.keys(result.files).length);
    });

    it('should produce string file contents (not Buffers or Uint8Arrays)', () => {
      const config = createValidConfig();
      const result = generate(config);

      for (const [path, content] of Object.entries(result.files)) {
        expect(typeof content).toBe('string');
        expect((content as string).length).toBeGreaterThan(0);
        expect(path).not.toContain('\\');
      }
    });

    it('should throw for an invalid config', () => {
      const config = createValidConfig();
      config.token.symbol = 'THIS_SYMBOL_IS_WAY_TOO_LONG';

      expect(() => generate(config)).toThrow(/invalid configuration/i);
    });
  });

  describe('generateZip() in Node.js', () => {
    it('should return a ZipResult with Blob data', async () => {
      const config = createValidConfig();
      const result: ZipResult = await generateZip(config);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('metadata');
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.data.size).toBeGreaterThan(0);
      expect(result.fileName).toBe('stst-rwa.zip');
    });

    it('should work without a progress callback', async () => {
      const config = createValidConfig();
      await expect(generateZip(config)).resolves.not.toThrow();
    });

    it('should work with a progress callback', async () => {
      const config = createValidConfig();
      const events: Array<{ phase: string; percentage: number }> = [];

      const result = await generateZip(config, {
        onProgress: (event) => events.push(event),
      });

      expect(result.data.size).toBeGreaterThan(0);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableModules() in Node.js', () => {
    it('should return an array of ComplianceModuleRegistryEntry objects', () => {
      const modules: ComplianceModuleRegistryEntry[] = getAvailableModules();

      expect(Array.isArray(modules)).toBe(true);

      for (const mod of modules) {
        expect(typeof mod.id).toBe('string');
        expect(typeof mod.name).toBe('string');
        expect(typeof mod.description).toBe('string');
        expect(Array.isArray(mod.supportedHooks)).toBe(true);
        for (const hook of mod.supportedHooks) {
          expect(['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed']).toContain(hook);
        }
      }
    });
  });

  describe('generateRoleSymbol() in Node.js', () => {
    it('should resolve well-known role names', () => {
      expect(generateRoleSymbol('manager')).toBe('manager');
      expect(generateRoleSymbol('agent')).toBe('agent');
      expect(generateRoleSymbol('operator')).toBe('operator');
    });

    it('should auto-generate symbols for custom roles', () => {
      const symbol = generateRoleSymbol('Compliance Officer');
      expect(typeof symbol).toBe('string');
      expect(symbol.length).toBeLessThanOrEqual(
        STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH
      );
    });
  });

  describe('end-to-end pipeline (validate → generate → generateZip)', () => {
    it('should complete the full pipeline without errors', async () => {
      const config = createValidConfig();

      const validationResult = validate(config);
      expect(validationResult.valid).toBe(true);

      const generationResult = generate(config);
      expect(Object.keys(generationResult.files).length).toBeGreaterThan(0);

      const zipResult = await generateZip(config);
      expect(zipResult.data.size).toBeGreaterThan(0);
      expect(zipResult.metadata.configHash).toBe(generationResult.metadata.configHash);
    });
  });

  describe('concurrent invocation safety (CR-009)', () => {
    it('should handle multiple parallel generate calls without interference', async () => {
      const config1 = createValidConfig();
      const config2: RWAConfig = {
        ...createValidConfig(),
        token: {
          name: 'Token B',
          symbol: 'TOKB',
          decimals: 6,
          documentManager: { enabled: false },
        },
      };

      const [result1, result2] = await Promise.all([
        Promise.resolve(generate(config1)),
        Promise.resolve(generate(config2)),
      ]);

      expect(result1.metadata.configHash).not.toBe(result2.metadata.configHash);
      expect(Object.keys(result1.files).length).toBeGreaterThan(0);
      expect(Object.keys(result2.files).length).toBeGreaterThan(0);

      const token1 = result1.files['contracts/rwa-token/src/contract.rs'] as string;
      const token2 = result2.files['contracts/rwa-token/src/contract.rs'] as string;

      expect(token1).toContain('set_metadata(e, 8,');
      expect(token2).toContain('set_metadata(e, 6,');

      expect(token1).toContain('DocumentManager');
      expect(token2).not.toContain('DocumentManager');
    });
  });
});
