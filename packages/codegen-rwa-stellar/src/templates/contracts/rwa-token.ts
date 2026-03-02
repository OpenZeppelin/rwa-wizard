import type { RWAConfig } from '@openzeppelin/rwa-config';

import { DEFAULT_TOKEN_VERSION, generateRoleSymbol } from '../../constants';

function buildImports(config: RWAConfig): string {
  const imports: string[] = ['use soroban_sdk::{contract, contractimpl, Address, Env, String};'];

  const sdkExtras: string[] = [];
  const hasRoles = config.accessControl.roles.length > 0;
  if (hasRoles) {
    sdkExtras.push('symbol_short');
  }
  if (config.token.documentManager.enabled) {
    sdkExtras.push('BytesN', 'Vec');
  }

  if (sdkExtras.length > 0) {
    imports[0] = `use soroban_sdk::{contract, contractimpl, ${sdkExtras.join(', ')}, Address, Env, String};`;
  }

  imports.push('use stellar_access::access_control::{self as access_control, AccessControl};');
  imports.push('use stellar_contract_utils::pausable::{self as pausable, Pausable};');
  imports.push(
    `use stellar_tokens::{
    fungible::{Base, FungibleToken},
    rwa::{RWAStorageKey, RWA},
};`
  );

  if (hasRoles) {
    imports.push('use stellar_macros::only_role;');
  }

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

  lines.push('    pub fn __constructor(');
  lines.push('        e: &Env,');
  lines.push('        name: String,');
  lines.push('        symbol: String,');
  lines.push('        admin: Address,');
  lines.push('        initial_supply: i128,');

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
      `        access_control::grant_role_no_auth(e, &admin, &${symbol}, &symbol_short!("${symbol}"));`
    );
  }

  if (config.token.initialSupply !== undefined) {
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

  if (config.token.documentManager.enabled) {
    sections.push('');
    sections.push(buildDocumentManagerImpl());
  }

  return sections.join('\n') + '\n';
}
