import { beforeEach, describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { createTestCodegenService, getCodegenService } from './index';
import type { RwaCodegenService, ValidationResultDTO } from './types';

function makeConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return { ...createDefaultRwaConfig(), ...overrides };
}

describe('Codegen Service Contract Parity', () => {
  let testService: RwaCodegenService;

  beforeEach(() => {
    testService = createTestCodegenService();
  });

  describe('validate()', () => {
    it('returns a ValidationResultDTO with valid, errors, and warnings', async () => {
      const config = makeConfig();
      const result = await testService.validate(config);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('returns valid: true for a default config', async () => {
      const result = await testService.validate(makeConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors with field, code, message shape when present', async () => {
      const result = await testService.validate(makeConfig());
      const shape: ValidationResultDTO = { valid: true, errors: [], warnings: [] };
      expect(Object.keys(result).sort()).toEqual(Object.keys(shape).sort());
    });
  });

  describe('getAvailableModules()', () => {
    it('returns an array of ComplianceModuleOption', async () => {
      const modules = await testService.getAvailableModules();
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
    });

    it('each module has id, name, description, requiredHooks, review, configFields', async () => {
      const modules = await testService.getAvailableModules();
      for (const mod of modules) {
        expect(mod).toHaveProperty('id');
        expect(mod).toHaveProperty('name');
        expect(mod).toHaveProperty('description');
        expect(mod).toHaveProperty('requiredHooks');
        expect(mod).toHaveProperty('review');
        expect(mod).toHaveProperty('configFields');
        expect(typeof mod.id).toBe('string');
        expect(typeof mod.name).toBe('string');
        expect(Array.isArray(mod.requiredHooks)).toBe(true);
        expect(mod.review).toHaveProperty('state');
        expect(Array.isArray(mod.configFields)).toBe(true);
      }
    });

    it('module review has state as stable or under-review', async () => {
      const modules = await testService.getAvailableModules();
      for (const mod of modules) {
        expect(['stable', 'under-review']).toContain(mod.review.state);
      }
    });

    it('configFields have key, label, type, required properties', async () => {
      const modules = await testService.getAvailableModules();
      const withFields = modules.filter((m) => m.configFields.length > 0);
      expect(withFields.length).toBeGreaterThan(0);
      for (const mod of withFields) {
        for (const field of mod.configFields) {
          expect(field).toHaveProperty('key');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('required');
          expect(['string', 'number', 'string[]']).toContain(field.type);
        }
      }
    });
  });

  describe('generateZip()', () => {
    it('returns a GeneratedZipArtifact with fileName and data', async () => {
      const config = makeConfig({
        token: { ...createDefaultRwaConfig().token, name: 'Test', symbol: 'TST' },
      });
      const result = await testService.generateZip(config);
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('data');
      expect(typeof result.fileName).toBe('string');
      expect(result.fileName).toMatch(/\.zip$/);
      expect(result.data).toBeInstanceOf(Blob);
    });

    it('fires onStatus callbacks in phase order', async () => {
      const config = makeConfig({
        token: { ...createDefaultRwaConfig().token, name: 'Test', symbol: 'TST' },
      });
      const phases: string[] = [];
      await testService.generateZip(config, {
        onStatus: (status) => phases.push(status.phase),
      });

      expect(phases).toContain('validating');
      expect(phases).toContain('generating');
      expect(phases).toContain('packaging');
      expect(phases).toContain('success');
      expect(phases.indexOf('validating')).toBeLessThan(phases.indexOf('generating'));
      expect(phases.indexOf('generating')).toBeLessThan(phases.indexOf('packaging'));
      expect(phases.indexOf('packaging')).toBeLessThan(phases.indexOf('success'));
    });

    it('derives fileName from token symbol', async () => {
      const config = makeConfig({
        token: { ...createDefaultRwaConfig().token, name: 'Test', symbol: 'ABC' },
      });
      const result = await testService.generateZip(config);
      expect(result.fileName).toContain('abc');
    });
  });

  describe('getCodegenService() resolver', () => {
    it('returns null when real codegen is not loaded', () => {
      const service = getCodegenService('stellar');
      expect(service).toBeNull();
    });

    it('throws for an unknown target', () => {
      expect(() => getCodegenService('unknown-target')).toThrow('codegen/unknown-target');
    });
  });

  describe('test service determinism', () => {
    it('returns identical modules on repeated calls', async () => {
      const first = await testService.getAvailableModules();
      const second = await testService.getAvailableModules();
      expect(first).toEqual(second);
    });

    it('returns identical validation on repeated calls', async () => {
      const config = makeConfig();
      const first = await testService.validate(config);
      const second = await testService.validate(config);
      expect(first).toEqual(second);
    });
  });
});
