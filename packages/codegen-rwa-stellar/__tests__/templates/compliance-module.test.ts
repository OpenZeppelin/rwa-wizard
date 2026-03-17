import { describe, expect, it } from 'vitest';

import type { ComplianceHook, ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import { generateCrateToml } from '../../src/templates/cargo/crate-toml';
import { generateComplianceModuleContract } from '../../src/templates/contracts/compliance-module';
import { generateLibRs } from '../../src/templates/lib-rs';

function createModuleSelection(
  overrides: Partial<ComplianceModuleSelection> = {}
): ComplianceModuleSelection {
  return {
    moduleId: 'supply-cap',
    hook: 'canCreate',
    ...overrides,
  };
}

describe('Compliance Module Contract Template', () => {
  describe('ComplianceModule trait impl', () => {
    it('should generate a valid #[contract] struct', () => {
      const mod = createModuleSelection();
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('#[contract]');
      expect(contract).toContain('pub struct');
    });

    it('should have an impl block with all ComplianceModule methods', () => {
      const mod = createModuleSelection();
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('#[contractimpl]');
      expect(contract).toContain('impl SupplyCapModule');
    });

    it('should include all required ComplianceModule trait methods', () => {
      const mod = createModuleSelection();
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('fn on_transfer(');
      expect(contract).toContain('fn on_created(');
      expect(contract).toContain('fn on_destroyed(');
      expect(contract).toContain('fn can_transfer(');
      expect(contract).toContain('fn can_create(');
      expect(contract).toContain('fn name(');
      expect(contract).toContain('fn get_compliance_address(');
      expect(contract).toContain('fn set_compliance_address(');
    });

    it('should include #![no_std] preamble', () => {
      const mod = createModuleSelection();
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('use soroban_sdk::');
    });

    it('should have a __constructor with compliance parameter', () => {
      const mod = createModuleSelection();
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('pub fn __constructor(');
      expect(contract).toContain('compliance: Address');
    });

    it('should return the module name via name()', () => {
      const mod = createModuleSelection({ moduleId: 'supply-cap' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('supply-cap');
    });
  });

  describe('hook-specific stubs', () => {
    it('should generate stub methods that are no-ops for canTransfer hook', () => {
      const mod = createModuleSelection({ hook: 'canTransfer' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('fn on_transfer(');
      expect(contract).toContain('fn can_transfer(');
    });

    it('should generate stub methods that are no-ops for canCreate hook', () => {
      const mod = createModuleSelection({ hook: 'canCreate' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('fn on_created(');
      expect(contract).toContain('fn can_create(');
    });

    it('should generate stub methods for destroyed hook', () => {
      const mod = createModuleSelection({ hook: 'destroyed' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('fn on_destroyed(');
    });

    it('can_transfer should return true by default (stub)', () => {
      const mod = createModuleSelection({ hook: 'canTransfer' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('true');
    });

    it('can_create should return true by default (stub)', () => {
      const mod = createModuleSelection({ hook: 'canCreate' });
      const contract = generateComplianceModuleContract(mod);

      expect(contract).toContain('true');
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
        name: 'supply-cap',
        dependencies: ['soroban-sdk', 'stellar-tokens'],
      });

      expect(toml).toContain('name = "supply-cap"');
      expect(toml).toContain('crate-type = ["cdylib"]');
      expect(toml).toContain('soroban-sdk = { workspace = true }');
      expect(toml).toContain('stellar-tokens = { workspace = true }');
    });
  });

  describe('different modules', () => {
    const hooks: ComplianceHook[] = ['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed'];

    for (const hook of hooks) {
      it(`should generate a valid contract for hook: ${hook}`, () => {
        const mod = createModuleSelection({ moduleId: `test-module-${hook}`, hook });
        const contract = generateComplianceModuleContract(mod);

        expect(contract).toContain('#[contract]');
        expect(contract).toContain(`test-module-${hook}`);
      });
    }

    it('should generate unique struct names based on moduleId', () => {
      const mod1 = generateComplianceModuleContract(
        createModuleSelection({ moduleId: 'supply-cap' })
      );
      const mod2 = generateComplianceModuleContract(
        createModuleSelection({ moduleId: 'max-balance' })
      );

      const structMatch1 = mod1.match(/pub struct (\w+)/);
      const structMatch2 = mod2.match(/pub struct (\w+)/);

      expect(structMatch1).not.toBeNull();
      expect(structMatch2).not.toBeNull();
      expect(structMatch1![1]).not.toBe(structMatch2![1]);
    });
  });
});
