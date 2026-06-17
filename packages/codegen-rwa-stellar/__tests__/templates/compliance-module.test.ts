import { describe, expect, it } from 'vitest';

import type { ComplianceModuleRegistryEntry } from '../../src/modules/registry';
import {
  generateComplianceModuleCargoToml,
  generateComplianceModuleContract,
} from '../../src/templates/contracts/compliance-module';
import { generateLibRs } from '../../src/templates/lib-rs';

function createEntry(
  overrides: Partial<ComplianceModuleRegistryEntry> = {}
): ComplianceModuleRegistryEntry {
  return {
    id: 'supply-limit',
    name: 'Supply Limit',
    requiredHooks: ['created', 'destroyed'],
    crateName: 'compliance-supply-limit',
    review: { state: 'stable' },
    configFields: [],
    ...overrides,
  };
}

describe('Compliance Module Contract Template', () => {
  it('uses the upstream supply-limit implementation as the source of truth', () => {
    const contract = generateComplianceModuleContract(createEntry());

    expect(contract).toContain('pub struct SupplyLimitContract;');
    expect(contract).toContain('impl ComplianceModule for SupplyLimitContract');
    expect(contract).toContain('impl SupplyLimit for SupplyLimitContract');
    expect(contract).toContain('pub fn __constructor(e: &Env, admin: Address, manager: Address)');
    expect(contract).toContain(
      'fn set_supply_limit(e: &Env, token: Address, limit: i128, operator: Address)'
    );
    expect(contract).toContain(
      'fn set_compliance_address(e: &Env, token: Address, compliance: Address, _operator: Address)'
    );
  });

  it('prepends a review banner for under-review modules', () => {
    const contract = generateComplianceModuleContract(
      createEntry({
        review: { state: 'under-review', prUrl: 'https://github.com/example/pull/1' },
      })
    );

    expect(contract).toContain('under review and not yet merged upstream');
    expect(contract).toContain('https://github.com/example/pull/1');
  });

  it('does not prepend a review banner for stable modules', () => {
    const contract = generateComplianceModuleContract(createEntry());
    expect(contract).not.toContain('under review and not yet merged upstream');
  });

  it('keeps the standard lib.rs crate wrapper', () => {
    const libRs = generateLibRs();
    expect(libRs).toContain('#![no_std]');
    expect(libRs).toContain('mod contract;');
    expect(libRs).toContain('pub use contract::*;');
  });

  it('generates upstream-aligned Cargo.toml for module crates', () => {
    const toml = generateComplianceModuleCargoToml(createEntry());

    expect(toml).toContain('name = "compliance-supply-limit"');
    expect(toml).toContain('crate-type = ["cdylib"]');
    expect(toml).toContain('[package.metadata.stellar]');
    expect(toml).toContain('edition.workspace = true');
    expect(toml).toContain('stellar-access = { workspace = true }');
    expect(toml).toContain('stellar-macros = { workspace = true }');
    expect(toml).toContain('stellar-tokens = { workspace = true }');
  });

  it('selects a different upstream module implementation per registry entry', () => {
    const supplyLimit = generateComplianceModuleContract(createEntry({ id: 'supply-limit' }));
    const maxBalance = generateComplianceModuleContract(createEntry({ id: 'max-balance' }));

    expect(supplyLimit).toContain('pub struct SupplyLimitContract;');
    expect(maxBalance).toContain('pub struct MaxBalanceContract;');
    expect(maxBalance).toContain(
      'fn set_max_balance(e: &Env, token: Address, max: i128, operator: Address)'
    );
  });
});
