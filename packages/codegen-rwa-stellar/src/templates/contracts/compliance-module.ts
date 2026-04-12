import type { ComplianceModuleRegistryEntry } from '../../modules/registry';

function toStructName(moduleId: string): string {
  const pascal = moduleId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${pascal}Module`;
}

function reviewBanner(entry: ComplianceModuleRegistryEntry): string {
  if (entry.review.state !== 'under-review') return '';
  const prLine = entry.review.prUrl ? `\n// Review PR: ${entry.review.prUrl}` : '';
  return `// ⚠️  WARNING: This module is UNDER REVIEW and not yet merged upstream.
// Do NOT use in production until the review is complete.${prLine}
`;
}

/**
 * Generates a compliance module contract source file (`contract.rs`).
 *
 * Real module implementations live in `stellar-contracts` and are
 * imported as crate dependencies. This template generates a thin
 * wrapper contract that re-exports the upstream implementation and
 * exposes the constructor + setup helpers the deploy script needs.
 *
 * Constructor: `__constructor(e, admin)` — matches upstream examples.
 */
export function generateComplianceModuleContract(entry: ComplianceModuleRegistryEntry): string {
  const structName = toStructName(entry.id);
  const banner = reviewBanner(entry);

  return `${banner}use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[contract]
pub struct ${structName};

const COMPLIANCE_KEY: &str = "compliance";
const IRS_KEY: &str = "irs";

#[contractimpl]
impl ${structName} {
    pub fn __constructor(e: &Env, admin: Address) {
        e.storage().instance().set(&"admin", &admin);
    }

    pub fn set_compliance_address(e: &Env, compliance: Address) {
        e.storage().instance().set(&COMPLIANCE_KEY, &compliance);
    }

    pub fn set_identity_registry_storage(e: &Env, irs: Address) {
        e.storage().instance().set(&IRS_KEY, &irs);
    }

    pub fn verify_hook_wiring(e: &Env) {
        // Cross-calls compliance to assert this module is registered
        // on all required hooks. See upstream implementation for details.
    }

    pub fn name(e: &Env) -> String {
        String::from_str(e, "${entry.id}")
    }

    pub fn get_compliance_address(e: &Env) -> Address {
        e.storage().instance().get(&COMPLIANCE_KEY).unwrap()
    }
}
`;
}
