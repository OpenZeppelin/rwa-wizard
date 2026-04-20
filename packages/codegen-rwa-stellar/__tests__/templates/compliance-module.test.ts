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
    requiredHooks: ['canCreate', 'created', 'destroyed'],
    crateName: 'supply-limit',
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
    expect(contract).toContain('pub fn __constructor(e: &Env, admin: Address)');
    expect(contract).toContain('fn require_module_admin_or_compliance_auth');
    expect(contract).toContain('pub fn set_supply_limit(e: &Env, token: Address, limit: i128)');
    expect(contract).toContain('pub fn verify_hook_wiring(e: &Env)');
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

  it('generates upstream-aligned Cargo.toml metadata for module crates', () => {
    const toml = generateCrateToml({
      name: 'supply-limit',
      dependencies: ['soroban-sdk', 'stellar-tokens'],
      includeRlib: true,
    });

    expect(toml).toContain('name = "supply-limit"');
    expect(toml).toContain('crate-type = ["cdylib", "rlib"]');
    expect(toml).toContain('[package.metadata.stellar]');
    expect(toml).toContain('edition.workspace = true');
  });

  it('selects a different upstream module implementation per registry entry', () => {
    const supplyLimit = generateComplianceModuleContract(createEntry({ id: 'supply-limit' }));
    const maxBalance = generateComplianceModuleContract(createEntry({ id: 'max-balance' }));

    expect(supplyLimit).toContain('pub struct SupplyLimitContract;');
    expect(maxBalance).toContain('pub struct MaxBalanceContract;');
    expect(maxBalance).toContain('pub fn set_max_balance');
  });
});
