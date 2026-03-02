import type { RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Generates the Identity Registry Storage (IRS) contract source code (`contract.rs`).
 *
 * Implements IdentityRegistryStorage + CountryDataManager + TokenBinder + AccessControl traits.
 * Constructor: `__constructor(e, admin)` per SR-016.
 *
 * Follows the canonical pattern from stellar-contracts/examples/rwa/src/identity_registry_storage.rs.
 */
export function generateIdentityRegistryStorageContract(_config: RWAConfig): string {
  return `use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Vec};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_macros::only_role;
use stellar_tokens::rwa::{
    identity_registry_storage::{
        self as identity_storage, CountryData, CountryDataManager, IdentityRegistryStorage,
        IdentityType,
    },
    utils::token_binder::{self as binder, TokenBinder},
};

#[contract]
pub struct IdentityRegistryContract;

#[contractimpl]
impl IdentityRegistryContract {
    pub fn __constructor(e: &Env, admin: Address) {
        access_control::set_admin(e, &admin);
    }
}

#[contractimpl]
impl TokenBinder for IdentityRegistryContract {
    fn linked_tokens(e: &Env) -> Vec<Address> {
        binder::linked_tokens(e)
    }

    #[only_role(operator, "manager")]
    fn bind_token(e: &Env, token: Address, operator: Address) {
        binder::bind_token(e, &token);
    }

    #[only_role(operator, "manager")]
    fn unbind_token(e: &Env, token: Address, operator: Address) {
        binder::unbind_token(e, &token);
    }
}

#[contractimpl]
impl IdentityRegistryStorage for IdentityRegistryContract {
    type CountryData = CountryData;

    #[only_role(operator, "manager")]
    fn add_identity(
        e: &Env,
        account: Address,
        identity: Address,
        initial_profiles: Vec<CountryData>,
        operator: Address,
    ) {
        identity_storage::add_identity(
            e,
            &account,
            &identity,
            IdentityType::Individual,
            &initial_profiles,
        );
    }

    #[only_role(operator, "manager")]
    fn modify_identity(e: &Env, account: Address, new_identity: Address, operator: Address) {
        identity_storage::modify_identity(e, &account, &new_identity);
    }

    #[only_role(operator, "manager")]
    fn remove_identity(e: &Env, account: Address, operator: Address) {
        identity_storage::remove_identity(e, &account);
    }

    fn stored_identity(e: &Env, account: Address) -> Address {
        identity_storage::stored_identity(e, &account)
    }

    #[only_role(operator, "manager")]
    fn recover_identity(e: &Env, old_account: Address, new_account: Address, operator: Address) {
        identity_storage::recover_identity(e, &old_account, &new_account);
    }

    fn get_recovered_to(e: &Env, old: Address) -> Option<Address> {
        identity_storage::get_recovered_to(e, &old)
    }
}

#[contractimpl]
impl CountryDataManager for IdentityRegistryContract {
    #[only_role(operator, "manager")]
    fn add_country_data_entries(
        e: &Env,
        account: Address,
        profiles: Vec<CountryData>,
        operator: Address,
    ) {
        identity_storage::add_country_data_entries(e, &account, &profiles);
    }

    #[only_role(operator, "manager")]
    fn modify_country_data(
        e: &Env,
        account: Address,
        index: u32,
        profile: CountryData,
        operator: Address,
    ) {
        identity_storage::modify_country_data(e, &account, index, &profile);
    }

    #[only_role(operator, "manager")]
    fn delete_country_data(e: &Env, account: Address, index: u32, operator: Address) {
        identity_storage::delete_country_data(e, &account, index);
    }

    fn get_country_data(e: &Env, account: Address, index: u32) -> CountryData {
        identity_storage::get_country_data(e, &account, index)
    }

    fn get_country_data_entries(e: &Env, account: Address) -> Vec<CountryData> {
        identity_storage::get_country_data_entries(e, &account)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for IdentityRegistryContract {}
`;
}
