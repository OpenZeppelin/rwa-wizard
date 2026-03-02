import type { RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Generates the Claim Topics & Issuers (CTI) contract source code (`contract.rs`).
 *
 * Implements ClaimTopicsAndIssuers + AccessControl traits.
 * Constructor: `__constructor(e, admin)` per SR-016.
 */
export function generateClaimTopicsIssuersContract(_config: RWAConfig): string {
  return `use soroban_sdk::{contract, contractimpl, Address, Env, Map, Vec};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;
use stellar_tokens::rwa::claim_topics_and_issuers::{
    storage as cti_storage, ClaimTopicsAndIssuers,
};

#[contract]
pub struct ClaimTopicsIssuersContract;

#[contractimpl]
impl ClaimTopicsIssuersContract {
    pub fn __constructor(e: &Env, admin: Address) {
        access_control::set_admin(e, &admin);
    }
}

#[contractimpl]
impl ClaimTopicsAndIssuers for ClaimTopicsIssuersContract {
    #[only_role(operator, "manager")]
    fn add_claim_topic(e: &Env, claim_topic: u32, operator: Address) {
        cti_storage::add_claim_topic(e, claim_topic);
    }

    #[only_role(operator, "manager")]
    fn remove_claim_topic(e: &Env, claim_topic: u32, operator: Address) {
        cti_storage::remove_claim_topic(e, claim_topic);
    }

    fn get_claim_topics(e: &Env) -> Vec<u32> {
        cti_storage::get_claim_topics(e)
    }

    #[only_role(operator, "manager")]
    fn add_trusted_issuer(
        e: &Env,
        trusted_issuer: Address,
        claim_topics: Vec<u32>,
        operator: Address,
    ) {
        cti_storage::add_trusted_issuer(e, &trusted_issuer, &claim_topics);
    }

    #[only_role(operator, "manager")]
    fn remove_trusted_issuer(e: &Env, trusted_issuer: Address, operator: Address) {
        cti_storage::remove_trusted_issuer(e, &trusted_issuer);
    }

    #[only_role(operator, "manager")]
    fn update_issuer_claim_topics(
        e: &Env,
        trusted_issuer: Address,
        claim_topics: Vec<u32>,
        operator: Address,
    ) {
        cti_storage::update_issuer_claim_topics(e, &trusted_issuer, &claim_topics);
    }

    fn get_trusted_issuers(e: &Env) -> Vec<Address> {
        cti_storage::get_trusted_issuers(e)
    }

    fn get_claim_topic_issuers(e: &Env, claim_topic: u32) -> Vec<Address> {
        cti_storage::get_claim_topic_issuers(e, claim_topic)
    }

    fn get_claim_topics_and_issuers(e: &Env) -> Map<u32, Vec<Address>> {
        cti_storage::get_claim_topics_and_issuers(e)
    }

    fn is_trusted_issuer(e: &Env, issuer: Address) -> bool {
        cti_storage::is_trusted_issuer(e, &issuer)
    }

    fn get_trusted_issuer_claim_topics(e: &Env, trusted_issuer: Address) -> Vec<u32> {
        cti_storage::get_trusted_issuer_claim_topics(e, &trusted_issuer)
    }

    fn has_claim_topic(e: &Env, issuer: Address, claim_topic: u32) -> bool {
        cti_storage::has_claim_topic(e, &issuer, claim_topic)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for ClaimTopicsIssuersContract {}
`;
}
