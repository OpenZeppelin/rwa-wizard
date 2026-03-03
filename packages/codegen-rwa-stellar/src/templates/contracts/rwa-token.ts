import type { RWAConfig } from '@openzeppelin/rwa-config';

import { DEFAULT_TOKEN_VERSION, generateRoleSymbol } from '../../constants';

function buildImports(config: RWAConfig): string {
  const sdkItems: string[] = ['contract', 'contractimpl'];

  const hasRoles = config.accessControl.roles.length > 0;
  if (hasRoles) {
    sdkItems.push('symbol_short');
  }
  if (config.token.documentManager.enabled) {
    sdkItems.push('BytesN');
  }

  // MuxedAddress, Symbol, and Vec are required by the #[contractimpl(contracttrait)]
  // macro expansions for FungibleToken and AccessControl
  sdkItems.push('MuxedAddress', 'Symbol', 'Vec');
  sdkItems.push('Address', 'Env', 'String');

  const imports: string[] = [`use soroban_sdk::{${sdkItems.join(', ')}};`];

  imports.push('use stellar_access::access_control::{self as access_control, AccessControl};');
  imports.push('use stellar_contract_utils::pausable::{self as pausable, Pausable};');

  const rwaImports = ['RWAStorageKey', 'RWAToken', 'RWA'];
  imports.push(
    `use stellar_tokens::{
    fungible::{Base, FungibleToken},
    rwa::{${rwaImports.join(', ')}},
};`
  );

  if (config.token.documentManager.enabled) {
    imports.push(
      `use stellar_tokens::rwa::extensions::doc_manager::{
    self as doc_manager, Document, DocumentManager,
};`
    );
  }

  return imports.join('\n');
}

function buildConstructor(config: RWAConfig): string {
  const roles = config.accessControl.roles;
  const lines: string[] = [];

  const hasInitialSupply = config.token.initialSupply !== undefined;

  lines.push('    pub fn __constructor(');
  lines.push('        e: &Env,');
  lines.push('        name: String,');
  lines.push('        symbol: String,');
  lines.push('        admin: Address,');

  if (hasInitialSupply) {
    lines.push('        initial_supply: i128,');
  }

  for (const role of roles) {
    const symbol = role.symbol ?? generateRoleSymbol(role.name);
    lines.push(`        ${symbol}: Address,`);
  }

  lines.push('    ) {');
  lines.push(`        Base::set_metadata(e, ${config.token.decimals}, name, symbol);`);
  lines.push(
    `        e.storage().instance().set(&RWAStorageKey::Version, &String::from_str(e, "${DEFAULT_TOKEN_VERSION}"));`
  );
  lines.push('        access_control::set_admin(e, &admin);');

  for (const role of roles) {
    const symbol = role.symbol ?? generateRoleSymbol(role.name);
    lines.push(
      `        access_control::grant_role_no_auth(e, &${symbol}, &symbol_short!("${symbol}"), &admin);`
    );
  }

  if (hasInitialSupply) {
    lines.push('        Base::mint(e, &admin, initial_supply);');
  }

  lines.push('    }');

  return lines.join('\n');
}

function buildPausableImpl(): string {
  return `#[contractimpl]
impl Pausable for RwaTokenContract {
    fn pause(e: &Env, caller: Address) {
        caller.require_auth();
        pausable::pause(e);
    }

    fn unpause(e: &Env, caller: Address) {
        caller.require_auth();
        pausable::unpause(e);
    }
}`;
}

function buildRWATokenImpl(): string {
  return `#[contractimpl]
impl RWAToken for RwaTokenContract {
    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {
        operator.require_auth();
        RWA::forced_transfer(e, &from, &to, amount);
    }

    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {
        operator.require_auth();
        RWA::mint(e, &to, amount);
    }

    fn burn(e: &Env, user_address: Address, amount: i128, operator: Address) {
        operator.require_auth();
        RWA::burn(e, &user_address, amount);
    }

    fn recover_balance(
        e: &Env,
        old_account: Address,
        new_account: Address,
        operator: Address,
    ) -> bool {
        operator.require_auth();
        RWA::recover_balance(e, &old_account, &new_account)
    }

    fn set_address_frozen(e: &Env, user_address: Address, freeze: bool, operator: Address) {
        operator.require_auth();
        RWA::set_address_frozen(e, &user_address, freeze);
    }

    fn freeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {
        operator.require_auth();
        RWA::freeze_partial_tokens(e, &user_address, amount);
    }

    fn unfreeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {
        operator.require_auth();
        RWA::unfreeze_partial_tokens(e, &user_address, amount);
    }

    fn is_frozen(e: &Env, user_address: Address) -> bool {
        RWA::is_frozen(e, &user_address)
    }

    fn get_frozen_tokens(e: &Env, user_address: Address) -> i128 {
        RWA::get_frozen_tokens(e, &user_address)
    }

    fn version(e: &Env) -> String {
        RWA::version(e)
    }

    fn onchain_id(e: &Env) -> Address {
        RWA::onchain_id(e)
    }

    fn set_compliance(e: &Env, compliance: Address, operator: Address) {
        operator.require_auth();
        RWA::set_compliance(e, &compliance);
    }

    fn compliance(e: &Env) -> Address {
        RWA::compliance(e)
    }

    fn set_identity_verifier(e: &Env, identity_verifier: Address, operator: Address) {
        operator.require_auth();
        RWA::set_identity_verifier(e, &identity_verifier);
    }

    fn identity_verifier(e: &Env) -> Address {
        RWA::identity_verifier(e)
    }
}`;
}

function buildDocumentManagerImpl(): string {
  return `#[contractimpl]
impl DocumentManager for RwaTokenContract {
    fn get_document(e: &Env, name: BytesN<32>) -> Document {
        doc_manager::get_document(e, &name)
    }

    fn set_document(
        e: &Env,
        name: BytesN<32>,
        uri: String,
        document_hash: BytesN<32>,
        operator: Address,
    ) {
        operator.require_auth();
        doc_manager::set_document(e, &name, &uri, &document_hash);
    }

    fn remove_document(e: &Env, name: BytesN<32>, operator: Address) {
        operator.require_auth();
        doc_manager::remove_document(e, &name);
    }

    fn get_documents(e: &Env, bucket_index: u32) -> Vec<(BytesN<32>, Document)> {
        doc_manager::get_documents(e, bucket_index)
    }
}`;
}

/**
 * Generates the RWA Token contract source code (`contract.rs`).
 *
 * Follows the canonical pattern from stellar-contracts/examples/rwa/:
 * empty struct, __constructor with Base::set_metadata + access_control setup,
 * FungibleToken/AccessControl/Pausable trait impls, conditional DocumentManager.
 */
export function generateRwaTokenContract(config: RWAConfig): string {
  const sections: string[] = [];

  sections.push(buildImports(config));
  sections.push('');
  sections.push('#[contract]');
  sections.push('pub struct RwaTokenContract;');
  sections.push('');
  sections.push('#[contractimpl]');
  sections.push('impl RwaTokenContract {');
  sections.push(buildConstructor(config));
  sections.push('}');
  sections.push('');
  sections.push('#[contractimpl(contracttrait)]');
  sections.push('impl FungibleToken for RwaTokenContract {');
  sections.push('    type ContractType = RWA;');
  sections.push('}');
  sections.push('');
  sections.push('#[contractimpl(contracttrait)]');
  sections.push('impl AccessControl for RwaTokenContract {}');
  sections.push('');
  sections.push(buildPausableImpl());
  sections.push('');
  sections.push(buildRWATokenImpl());

  if (config.token.documentManager.enabled) {
    sections.push('');
    sections.push(buildDocumentManagerImpl());
  }

  return sections.join('\n') + '\n';
}
