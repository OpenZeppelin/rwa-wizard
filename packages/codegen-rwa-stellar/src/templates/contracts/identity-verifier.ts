import type { RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Generates the Identity Verifier contract source code (`contract.rs`).
 *
 * Implements IdentityVerifier + AccessControl traits.
 * Constructor: `__constructor(e, admin, cti_address)` per SR-016.
 *
 * Trait methods sourced from stellar-contracts identity_verifier/mod.rs:
 *   - verify_identity(e, account)
 *   - recovery_target(e, old_account) -> Option<Address>
 *   - set_claim_topics_and_issuers(e, cti_address, operator)
 *   - claim_topics_and_issuers(e) -> Address
 *
 * Storage delegates sourced from identity_verifier/storage.rs:
 *   - verify_identity(e, account: &Address)
 *   - recovery_target(e, old_account: &Address) -> Option<Address>
 *   - set_claim_topics_and_issuers(e, cti: &Address)
 *   - claim_topics_and_issuers(e) -> Address
 */
export function generateIdentityVerifierContract(_config: RWAConfig): string {
  return `use soroban_sdk::{contract, contractimpl, Address, Env};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;
use stellar_tokens::rwa::identity_verifier::{
    storage as iv_storage, IdentityVerifier,
};

#[contract]
pub struct IdentityVerifierContract;

#[contractimpl]
impl IdentityVerifierContract {
    pub fn __constructor(e: &Env, admin: Address, cti_address: Address) {
        access_control::set_admin(e, &admin);
        iv_storage::set_claim_topics_and_issuers(e, &cti_address);
    }
}

#[contractimpl]
impl IdentityVerifier for IdentityVerifierContract {
    fn verify_identity(e: &Env, account: &Address) {
        iv_storage::verify_identity(e, account);
    }

    fn recovery_target(e: &Env, old_account: &Address) -> Option<Address> {
        iv_storage::recovery_target(e, old_account)
    }

    #[only_role(operator, "manager")]
    fn set_claim_topics_and_issuers(e: &Env, claim_topics_and_issuers: Address, operator: Address) {
        iv_storage::set_claim_topics_and_issuers(e, &claim_topics_and_issuers);
    }

    fn claim_topics_and_issuers(e: &Env) -> Address {
        iv_storage::claim_topics_and_issuers(e)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for IdentityVerifierContract {}
`;
}
