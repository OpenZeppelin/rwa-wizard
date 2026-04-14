/**
 * Developer note:
 *
 * This file is not the canonical Rust contract template. The source of truth
 * lives in the upstream `stellar-contracts` example loaded via the active
 * `UpstreamTemplateSource` (bundled snapshot by default, local checkout in
 * supported Node.js workflows).
 *
 * This module exists only to apply the minimal config-driven deltas that the
 * upstream example cannot express directly yet:
 * - token decimals
 * - additional configured roles
 * - optional DocumentManager support
 *
 * Drift is avoided by:
 * - always starting from the upstream source, never from a copied local Rust file
 * - anchoring local edits to exact upstream snippets via `UPSTREAM_*` markers
 * - using `replaceExact()` / `insert*Exact()` so missing or changed markers fail fast
 *
 * Keep this patch layer narrow. Prefer extending upstream templates or adding
 * small exact-match patches over reintroducing a full handwritten local Rust
 * template.
 */
import { insertAfterExact, insertBeforeExact, replaceExact } from '@openzeppelin/codegen-core';
import { getAdditionalRoleAssignments } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { roleSymbolToRustIdentifier } from '../../access-control';
import { generateRoleSymbol } from '../../constants';
import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';

const UPSTREAM_SDK_IMPORT = `use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, Env, MuxedAddress, String, Symbol, Vec,
};`;

const UPSTREAM_TOKEN_IMPORT = `use stellar_tokens::{
    fungible::{Base, FungibleToken},
    rwa::{RWAToken, RWA},
};
`;

const UPSTREAM_ROLE_CONSTANT = 'const MANAGER_ROLE: Symbol = symbol_short!("manager");';

const UPSTREAM_CONSTRUCTOR = `    pub fn __constructor(
        e: &Env,
        name: String,
        symbol: String,
        admin: Address,
        manager: Address,
        compliance: Address,
        identity_verifier: Address,
    ) {
        Base::set_metadata(e, 7, name, symbol);

        access_control::set_admin(e, &admin);

        // create a role "manager" and grant it to \`manager\`
        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);

        RWA::set_compliance(e, &compliance);
        RWA::set_identity_verifier(e, &identity_verifier);
    }`;

const roleResolutionOptions = { generateRoleSymbol };

/**
 * Resolve all non-manager roles that need constructor wiring.
 */
function getAdditionalRoles(config: RWAConfig) {
  return getAdditionalRoleAssignments(config, roleResolutionOptions);
}

/**
 * Convert a role symbol into the uppercase Rust constant name used in templates.
 */
function toRoleConstName(symbol: string): string {
  return `${symbol
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()}_ROLE`;
}

/**
 * Build the role constant block injected into the upstream token template.
 */
function buildRoleConstants(config: RWAConfig): string {
  const lines = [UPSTREAM_ROLE_CONSTANT];
  for (const role of getAdditionalRoles(config)) {
    lines.push(`const ${toRoleConstName(role.symbol)}: Symbol = symbol_short!("${role.symbol}");`);
  }
  return lines.join('\n');
}

/**
 * Build the patched constructor with configured decimals and extra roles.
 */
function buildConstructor(config: RWAConfig): string {
  const additionalRoles = getAdditionalRoles(config);
  const lines: string[] = [
    '    pub fn __constructor(',
    '        e: &Env,',
    '        name: String,',
    '        symbol: String,',
    '        admin: Address,',
    '        manager: Address,',
    '        compliance: Address,',
    '        identity_verifier: Address,',
  ];

  for (const role of additionalRoles) {
    lines.push(`        ${roleSymbolToRustIdentifier(role.symbol)}: Address,`);
  }

  lines.push('    ) {');
  lines.push(`        Base::set_metadata(e, ${config.token.decimals}, name, symbol);`);
  lines.push('');
  lines.push('        access_control::set_admin(e, &admin);');
  lines.push('');
  lines.push('        // create a role "manager" and grant it to `manager`');
  lines.push('        access_control::grant_role_no_auth(e, &manager, &MANAGER_ROLE, &admin);');

  for (const role of additionalRoles) {
    lines.push(
      `        access_control::grant_role_no_auth(e, &${roleSymbolToRustIdentifier(role.symbol)}, &${toRoleConstName(role.symbol)}, &admin);`
    );
  }

  lines.push('');
  lines.push('        RWA::set_compliance(e, &compliance);');
  lines.push('        RWA::set_identity_verifier(e, &identity_verifier);');
  lines.push('    }');

  return lines.join('\n');
}

/**
 * Generate the optional DocumentManager implementation block.
 */
function buildDocumentManagerImpl(): string {
  return `#[contractimpl]
impl DocumentManager for RWATokenContract {
    fn get_document(e: &Env, name: BytesN<32>) -> Document {
        doc_manager::get_document(e, &name)
    }

    #[only_role(operator, "manager")]
    fn set_document(
        e: &Env,
        name: BytesN<32>,
        uri: String,
        document_hash: BytesN<32>,
        operator: Address,
    ) {
        doc_manager::set_document(e, &name, &uri, &document_hash);
    }

    #[only_role(operator, "manager")]
    fn remove_document(e: &Env, name: BytesN<32>, operator: Address) {
        doc_manager::remove_document(e, &name);
    }

    fn get_documents(e: &Env, bucket_index: u32) -> Vec<(BytesN<32>, Document)> {
        doc_manager::get_documents(e, bucket_index)
    }
}`;
}

/**
 * Inject the DocumentManager extension imports and implementation.
 */
function addDocumentManagerSupport(source: string): string {
  let patched = replaceExact(
    source,
    UPSTREAM_SDK_IMPORT,
    `use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, Env, MuxedAddress, String, Symbol, Vec,
};`
  );

  patched = insertAfterExact(
    patched,
    UPSTREAM_TOKEN_IMPORT,
    `
use stellar_tokens::rwa::extensions::doc_manager::{
    self as doc_manager, Document, DocumentManager,
};
`
  );

  return insertBeforeExact(
    patched,
    '#[contractimpl(contracttrait)]\nimpl AccessControl for RWATokenContract {}\n',
    `\n${buildDocumentManagerImpl()}\n\n`
  );
}

/**
 * Generates the RWA Token contract source code (`contract.rs`).
 *
 * Uses the upstream example as the baseline, then patches the constructor and
 * optional extensions with generator-specific configuration values.
 */
export function generateRwaTokenContract(
  config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  let source = templateSource.getTemplate('core-contract', 'rwa-token');
  source = replaceExact(source, UPSTREAM_ROLE_CONSTANT, buildRoleConstants(config));
  source = replaceExact(source, UPSTREAM_CONSTRUCTOR, buildConstructor(config));

  if (config.token.documentManager.enabled) {
    source = addDocumentManagerSupport(source);
  }

  return source;
}
