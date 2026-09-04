//! RWA Token Example Contract.

use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, Env, MuxedAddress, String, Symbol, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_macros::only_admin;
use stellar_tokens::{
    fungible::{Base, FungibleToken},
    rwa::{RWAToken, RWA},
};

use stellar_tokens::rwa::extensions::doc_manager::{
    self as doc_manager, Document, DocumentManager,
};

const MANAGER_ROLE: Symbol = symbol_short!("manager");
const COMPLIANC_ROLE: Symbol = symbol_short!("complianc");

fn grant_role_members(e: &Env, accounts: Vec<Address>, role: &Symbol, admin: &Address) {
    for account in accounts.iter() {
        access_control::grant_role_no_auth(e, &account, role, admin);
    }
}

#[contract]
pub struct RWATokenContract;

#[contractimpl]
impl RWATokenContract {
    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        admin: Address,
        manager: Address,
        compliance: Address,
        identity_verifier: Address,
        complianc: Vec<Address>,
    ) {
        Base::set_metadata(e, 18, name, symbol);

        access_control::set_admin(e, &admin);

        // create a role "manager" and grant it to `manager`
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);
        grant_role_members(e, complianc, &COMPLIANC_ROLE, &admin);

        RWA::set_compliance(e, &compliance);
        RWA::set_identity_verifier(e, &identity_verifier);
    }
}

#[contractimpl(contracttrait)]
impl Pausable for RWATokenContract {
    #[only_admin]
    fn pause(e: &Env, _caller: Address) {
        pausable::pause(e);
    }

    #[only_admin]
    fn unpause(e: &Env, _caller: Address) {
        pausable::unpause(e);
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for RWATokenContract {
    type ContractType = RWA;
}

#[contractimpl(contracttrait)]
impl RWAToken for RWATokenContract {
    #[only_admin]
    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {
        let _ = &operator;
        RWA::forced_transfer(e, &from, &to, amount);
    }

    #[only_admin]
    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {
        let _ = &operator;
        RWA::mint(e, &to, amount);
    }

    #[only_admin]
    fn burn(e: &Env, user_address: Address, amount: i128, operator: Address) {
        let _ = &operator;
        RWA::burn(e, &user_address, amount);
    }

    #[only_admin]
    fn recover_balance(
        e: &Env,
        old_account: Address,
        new_account: Address,
        operator: Address,
    ) -> bool {
        let _ = &operator;
        RWA::recover_balance(e, &old_account, &new_account)
    }

    #[only_admin]
    fn set_address_frozen(e: &Env, user_address: Address, freeze: bool, operator: Address) {
        let _ = &operator;
        RWA::set_address_frozen(e, &user_address, freeze);
    }

    #[only_admin]
    fn freeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {
        let _ = &operator;
        RWA::freeze_partial_tokens(e, &user_address, amount);
    }

    #[only_admin]
    fn unfreeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {
        let _ = &operator;
        RWA::unfreeze_partial_tokens(e, &user_address, amount);
    }

    #[only_admin]
    fn set_compliance(e: &Env, compliance: Address, operator: Address) {
        let _ = &operator;
        RWA::set_compliance(e, &compliance);
    }

    #[only_admin]
    fn set_identity_verifier(e: &Env, identity_verifier: Address, operator: Address) {
        let _ = &operator;
        RWA::set_identity_verifier(e, &identity_verifier);
    }
}


#[contractimpl]
impl DocumentManager for RWATokenContract {
    fn get_document(e: &Env, name: BytesN<32>) -> Document {
        doc_manager::get_document(e, &name)
    }

    #[only_admin]
    fn set_document(
        e: &Env,
        name: BytesN<32>,
        uri: String,
        document_hash: BytesN<32>,
        operator: Address,
    ) {
        let _ = &operator;
        doc_manager::set_document(e, &name, &uri, &document_hash);
    }

    #[only_admin]
    fn remove_document(e: &Env, name: BytesN<32>, operator: Address) {
        let _ = &operator;
        doc_manager::remove_document(e, &name);
    }

    fn get_documents(e: &Env, bucket_index: u32) -> Vec<(BytesN<32>, Document)> {
        doc_manager::get_documents(e, bucket_index)
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for RWATokenContract {}
