import {
  getAdditionalRoleAssignments,
  getResolvedRoleAssignments,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { roleSymbolToRustIdentifier } from '../../access-control';
import { generateRoleSymbol } from '../../constants';

const roleResolutionOptions = { generateRoleSymbol };

const roleAliases = {
  pauser: ['pauser', 'pausing'],
  minter: ['minter', 'minting'],
  burner: ['burner', 'burning'],
  freezer: ['freezer', 'freezing'],
  partialFreezer: ['partial-freezer', 'partial-freezing'],
  forcedTransfer: ['forced-transfer', 'forced-transfers'],
  recovery: ['recovery'],
  compliance: ['compliance'],
  identity: ['identity'],
  documentManager: ['document-manager', 'document-management'],
} as const;

export const pausableGuardSignatures = [
  '    fn pause(e: &Env, _caller: Address) {',
  '    fn unpause(e: &Env, _caller: Address) {',
] as const;

export const rwaTokenGuardPatches = [
  {
    aliases: roleAliases.forcedTransfer,
    signature:
      '    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {',
  },
  {
    aliases: roleAliases.minter,
    signature: '    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {',
  },
  {
    aliases: roleAliases.burner,
    signature: '    fn burn(e: &Env, user_address: Address, amount: i128, operator: Address) {',
  },
  {
    aliases: roleAliases.recovery,
    signature: '    fn recover_balance(',
  },
  {
    aliases: roleAliases.freezer,
    signature:
      '    fn set_address_frozen(e: &Env, user_address: Address, freeze: bool, operator: Address) {',
  },
  {
    aliases: roleAliases.partialFreezer,
    signature:
      '    fn freeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {',
  },
  {
    aliases: roleAliases.partialFreezer,
    signature:
      '    fn unfreeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {',
  },
  {
    aliases: roleAliases.compliance,
    signature: '    fn set_compliance(e: &Env, compliance: Address, operator: Address) {',
  },
  {
    aliases: roleAliases.identity,
    signature:
      '    fn set_identity_verifier(e: &Env, identity_verifier: Address, operator: Address) {',
  },
] as const;

/**
 * Resolve all non-manager roles that need constructor wiring.
 */
export function getAdditionalRoles(config: RWAConfig) {
  return getAdditionalRoleAssignments(config, roleResolutionOptions);
}

export type AdditionalRole = ReturnType<typeof getAdditionalRoles>[number];

/**
 * Normalize a configured role name for semantic matching.
 */
function normalizeRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

/**
 * Resolve the configured symbol for one semantic role when that role is assigned.
 */
function getConfiguredRoleSymbol(
  config: RWAConfig,
  aliases: readonly string[]
): string | undefined {
  return getResolvedRoleAssignments(config, roleResolutionOptions).find((role) =>
    aliases.includes(normalizeRoleName(role.name))
  )?.symbol;
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
 * Build the access-control attribute for one generated token method.
 */
export function buildAccessAttribute(
  config: RWAConfig,
  aliases: readonly string[],
  paramName: string
): string {
  const symbol = getConfiguredRoleSymbol(config, aliases);
  return symbol ? `    #[only_role(${paramName}, "${symbol}")]` : '    #[only_admin]';
}

export function buildDocumentManagerAccessAttribute(config: RWAConfig): string {
  return buildAccessAttribute(config, roleAliases.documentManager, 'operator');
}

/**
 * Build the extra role constants/helpers inserted after the upstream manager role constant.
 */
export function buildAdditionalRoleSupport(additionalRoles: readonly AdditionalRole[]): string {
  const lines: string[] = [];
  for (const role of additionalRoles) {
    lines.push(`const ${toRoleConstName(role.symbol)}: Symbol = symbol_short!("${role.symbol}");`);
  }

  lines.push('');
  lines.push(
    'fn grant_role_members(e: &Env, accounts: Vec<Address>, role: &Symbol, admin: &Address) {'
  );
  lines.push('    for account in accounts.iter() {');
  lines.push('        access_control::grant_role_no_auth(e, &account, role, admin);');
  lines.push('    }');
  lines.push('}');

  return `\n${lines.join('\n')}`;
}

/**
 * Build the extra constructor params inserted after the upstream identity verifier param.
 */
export function buildAdditionalRoleParams(additionalRoles: readonly AdditionalRole[]): string {
  return `${additionalRoles
    .map((role) => `        ${roleSymbolToRustIdentifier(role.symbol)}: Vec<Address>,`)
    .join('\n')}\n`;
}

/**
 * Build the extra constructor grants inserted after the upstream manager grant.
 */
export function buildAdditionalRoleGrants(additionalRoles: readonly AdditionalRole[]): string {
  return `${additionalRoles
    .map(
      (role) =>
        `        grant_role_members(e, ${roleSymbolToRustIdentifier(role.symbol)}, &${toRoleConstName(role.symbol)}, &admin);`
    )
    .join('\n')}\n`;
}

export const rwaTokenRoleAliases = roleAliases;
