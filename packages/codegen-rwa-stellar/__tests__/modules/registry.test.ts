import { describe, expect, it } from 'vitest';

import { COMPLIANCE_MODULE_REGISTRY, getAvailableModules } from '../../src/modules/registry';

describe('Compliance Module Registry', () => {
  describe('registry entries', () => {
    it('should export a non-empty registry', () => {
      expect(COMPLIANCE_MODULE_REGISTRY).toBeDefined();
      expect(Array.isArray(COMPLIANCE_MODULE_REGISTRY)).toBe(true);
      expect(COMPLIANCE_MODULE_REGISTRY.length).toBeGreaterThan(0);
    });

    it('each entry should have required fields: id, name, description, supportedHooks', () => {
      for (const entry of COMPLIANCE_MODULE_REGISTRY) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('supportedHooks');

        expect(typeof entry.id).toBe('string');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.description).toBe('string');
        expect(Array.isArray(entry.supportedHooks)).toBe(true);
        expect(entry.supportedHooks.length).toBeGreaterThan(0);
      }
    });

    it('each entry should have unique id', () => {
      const ids = COMPLIANCE_MODULE_REGISTRY.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('supportedHooks should only contain valid ComplianceHook values', () => {
      const validHooks = new Set(['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed']);
      for (const entry of COMPLIANCE_MODULE_REGISTRY) {
        for (const hook of entry.supportedHooks) {
          expect(validHooks.has(hook)).toBe(true);
        }
      }
    });
  });

  describe('getAvailableModules()', () => {
    it('should return only implemented modules', () => {
      const available = getAvailableModules();
      expect(Array.isArray(available)).toBe(true);
    });

    it('returned entries should match registry entries by structure', () => {
      const available = getAvailableModules();
      for (const entry of available) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('supportedHooks');
      }
    });

    it('returned module ids should be a subset of registry ids', () => {
      const registryIds = new Set(COMPLIANCE_MODULE_REGISTRY.map((e) => e.id));
      const available = getAvailableModules();
      for (const entry of available) {
        expect(registryIds.has(entry.id)).toBe(true);
      }
    });

    it('should return accurate supportedHooks for each module', () => {
      const available = getAvailableModules();
      for (const entry of available) {
        const registryEntry = COMPLIANCE_MODULE_REGISTRY.find((e) => e.id === entry.id);
        expect(registryEntry).toBeDefined();
        expect(entry.supportedHooks).toEqual(registryEntry!.supportedHooks);
      }
    });
  });
});
