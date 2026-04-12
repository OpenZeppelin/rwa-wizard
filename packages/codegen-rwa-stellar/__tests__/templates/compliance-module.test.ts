import { describe, expect, it } from 'vitest';

import type { ComplianceModuleRegistryEntry } from '../../src/modules/registry';
import { generateCrateToml } from '../../src/templates/cargo/crate-toml';
import { generateComplianceModuleContract } from '../../src/templates/contracts/compliance-module';
import { generateLibRs } from '../../src/templates/lib-rs';

function createEntry(
  overrides: Partial<ComplianceModuleRegistryEntry> = {}
): ComplianceModuleRegistryEntry {
  return {
    id: 'supply-limit',
    name: 'Supply Limit',
    description: 'Enforces a maximum total supply for the token',
    requiredHooks: ['canCreate', 'created', 'destroyed'],
    crateName: 'supply-limit',
    review: { state: 'stable' },
    configFields: [],
    ...overrides,
  };
}

describe('Compliance Module Contract Template', () => {
  describe('contract structure', () => {
    it('should generate a valid #[contract] struct', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).toContain('#[contract]');
      expect(contract).toContain('pub struct SupplyLimitModule');
    });

    it('should have an impl block with #[contractimpl]', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).toContain('#[contractimpl]');
      expect(contract).toContain('impl SupplyLimitModule');
    });

    it('should include constructor with admin parameter', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).toContain('pub fn __constructor(');
      expect(contract).toContain('admin: Address');
    });

    it('should include setup helpers', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).toContain('fn set_compliance_address(');
      expect(contract).toContain('fn set_identity_registry_storage(');
      expect(contract).toContain('fn verify_hook_wiring(');
    });

    it('should return the module name via name()', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).toContain('"supply-limit"');
    });

    it('should include review banner for under-review modules', () => {
      const contract = generateComplianceModuleContract(
        createEntry({
          review: { state: 'under-review', prUrl: 'https://github.com/example/pull/1' },
        })
      );
      expect(contract).toContain('UNDER REVIEW');
      expect(contract).toContain('https://github.com/example/pull/1');
    });

    it('should not include review banner for stable modules', () => {
      const contract = generateComplianceModuleContract(createEntry());
      expect(contract).not.toContain('UNDER REVIEW');
    });
  });

  describe('separate crate structure', () => {
    it('should generate valid lib.rs for module crate', () => {
      const libRs = generateLibRs();
      expect(libRs).toContain('#![no_std]');
      expect(libRs).toContain('mod contract;');
      expect(libRs).toContain('pub use contract::*;');
    });

    it('should generate valid Cargo.toml for module crate', () => {
      const toml = generateCrateToml({
        name: 'supply-limit',
        dependencies: ['soroban-sdk', 'stellar-tokens'],
      });
      expect(toml).toContain('name = "supply-limit"');
      expect(toml).toContain('crate-type = ["cdylib"]');
      expect(toml).toContain('soroban-sdk = { workspace = true }');
      expect(toml).toContain('stellar-tokens = { workspace = true }');
    });
  });

  describe('different modules', () => {
    it('should generate unique struct names based on moduleId', () => {
      const mod1 = generateComplianceModuleContract(createEntry({ id: 'supply-limit' }));
      const mod2 = generateComplianceModuleContract(createEntry({ id: 'max-balance' }));

      const structMatch1 = mod1.match(/pub struct (\w+)/);
      const structMatch2 = mod2.match(/pub struct (\w+)/);

      expect(structMatch1).not.toBeNull();
      expect(structMatch2).not.toBeNull();
      expect(structMatch1![1]).not.toBe(structMatch2![1]);
    });

    it('should embed module id in the name() return', () => {
      const contract = generateComplianceModuleContract(
        createEntry({ id: 'country-restrict' })
      );
      expect(contract).toContain('"country-restrict"');
    });
  });
});
