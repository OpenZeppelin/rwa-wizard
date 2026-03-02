import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';

/**
 * Converts a kebab-case moduleId into a PascalCase Rust struct name.
 * e.g., "supply-cap" → "SupplyCapModule"
 */
function toStructName(moduleId: string): string {
  const pascal = moduleId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${pascal}Module`;
}

/**
 * Generates a compliance module contract source file (`contract.rs`).
 *
 * Produces a stub implementation of the `ComplianceModule` trait.
 * All hook methods are no-ops or return `true` for validation hooks.
 * Actual compliance logic will be added when upstream `stellar-contracts`
 * ships concrete module implementations.
 *
 * Constructor: `__constructor(e, compliance)` — stores the compliance
 * contract address for authorization checks.
 */
export function generateComplianceModuleContract(mod: ComplianceModuleSelection): string {
  const structName = toStructName(mod.moduleId);

  return `use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[contract]
pub struct ${structName};

// Storage key for the compliance contract address.
const COMPLIANCE_KEY: &str = "compliance";

#[contractimpl]
impl ${structName} {
    pub fn __constructor(e: &Env, compliance: Address) {
        e.storage().instance().set(&COMPLIANCE_KEY, &compliance);
    }
}

/// Stub implementation of the ComplianceModule trait.
/// All hook methods are no-ops; validation hooks return \`true\` (allow all).
/// Replace with actual compliance logic when module implementations are ready.
#[contractimpl]
impl ${structName} {
    pub fn on_transfer(e: &Env, _from: Address, _to: Address, _amount: i128, _token: Address) {
        // TODO: Implement ${mod.moduleId} transfer hook logic
    }

    pub fn on_created(e: &Env, _to: Address, _amount: i128, _token: Address) {
        // TODO: Implement ${mod.moduleId} creation hook logic
    }

    pub fn on_destroyed(e: &Env, _from: Address, _amount: i128, _token: Address) {
        // TODO: Implement ${mod.moduleId} destruction hook logic
    }

    pub fn can_transfer(
        e: &Env,
        _from: Address,
        _to: Address,
        _amount: i128,
        _token: Address,
    ) -> bool {
        true
    }

    pub fn can_create(e: &Env, _to: Address, _amount: i128, _token: Address) -> bool {
        true
    }

    pub fn name(e: &Env) -> String {
        String::from_str(e, "${mod.moduleId}")
    }

    pub fn get_compliance_address(e: &Env) -> Address {
        e.storage().instance().get(&COMPLIANCE_KEY).unwrap()
    }

    pub fn set_compliance_address(e: &Env, compliance: Address) {
        e.storage().instance().set(&COMPLIANCE_KEY, &compliance);
    }
}
`;
}
