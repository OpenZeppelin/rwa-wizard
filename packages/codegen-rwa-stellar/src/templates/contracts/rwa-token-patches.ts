import { insertAfterExact, replaceExact } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { rwaTokenMarkers } from './rwa-token-markers';
import {
  buildAccessAttribute,
  buildAdditionalRoleGrants,
  buildAdditionalRoleParams,
  buildAdditionalRoleSupport,
  getAdditionalRoles,
  pausableGuardSignatures,
  rwaTokenGuardPatches,
  rwaTokenRoleAliases,
} from './rwa-token-roles';

/**
 * Replace one upstream method guard while keeping the upstream method body intact.
 */
function replaceMethodGuard(
  source: string,
  currentAttribute: string,
  signature: string,
  replacementAttribute: string
): string {
  if (currentAttribute === replacementAttribute) {
    return source;
  }

  return replaceExact(
    source,
    `${currentAttribute}\n${signature}`,
    `${replacementAttribute}\n${signature}`
  );
}

/**
 * Patch the upstream constructor in-place with configured decimals and extra roles.
 */
function patchConstructor(source: string, config: RWAConfig): string {
  let patched = replaceExact(
    source,
    rwaTokenMarkers.metadataLine,
    `        Base::set_metadata(e, ${config.token.decimals}, name, symbol);`
  );
  const additionalRoles = getAdditionalRoles(config);
  if (additionalRoles.length === 0) {
    return patched;
  }

  patched = insertAfterExact(
    patched,
    rwaTokenMarkers.identityVerifierParam,
    buildAdditionalRoleParams(additionalRoles)
  );

  return insertAfterExact(
    patched,
    rwaTokenMarkers.managerRoleGrant,
    buildAdditionalRoleGrants(additionalRoles)
  );
}

/**
 * Patch Pausable guards without replacing the full upstream impl block.
 */
function patchPausableGuards(source: string, config: RWAConfig): string {
  const pauseGuard = buildAccessAttribute(config, rwaTokenRoleAliases.pauser, '_caller');

  return pausableGuardSignatures.reduce(
    (patched, signature) =>
      replaceMethodGuard(patched, rwaTokenMarkers.adminGuard, signature, pauseGuard),
    source
  );
}

/**
 * Patch RWAToken method guards without replacing the full upstream impl block.
 */
function patchRwaTokenGuards(source: string, config: RWAConfig): string {
  return rwaTokenGuardPatches.reduce(
    (patched, patch) =>
      replaceMethodGuard(
        patched,
        rwaTokenMarkers.managerGuard,
        patch.signature,
        buildAccessAttribute(config, patch.aliases, 'operator')
      ),
    source
  );
}

/**
 * Make intentionally ABI-required operator parameters visibly used to Rust.
 */
function markOperatorParametersUsed(source: string): string {
  const patches = [
    [
      '    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {\n        RWA::forced_transfer(e, &from, &to, amount);',
      '    fn forced_transfer(e: &Env, from: Address, to: Address, amount: i128, operator: Address) {\n        let _ = &operator;\n        RWA::forced_transfer(e, &from, &to, amount);',
    ],
    [
      '    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {\n        RWA::mint(e, &to, amount);',
      '    fn mint(e: &Env, to: Address, amount: i128, operator: Address) {\n        let _ = &operator;\n        RWA::mint(e, &to, amount);',
    ],
    [
      '    fn burn(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        RWA::burn(e, &user_address, amount);',
      '    fn burn(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        let _ = &operator;\n        RWA::burn(e, &user_address, amount);',
    ],
    [
      '    ) -> bool {\n        RWA::recover_balance(e, &old_account, &new_account)',
      '    ) -> bool {\n        let _ = &operator;\n        RWA::recover_balance(e, &old_account, &new_account)',
    ],
    [
      '    fn set_address_frozen(e: &Env, user_address: Address, freeze: bool, operator: Address) {\n        RWA::set_address_frozen(e, &user_address, freeze);',
      '    fn set_address_frozen(e: &Env, user_address: Address, freeze: bool, operator: Address) {\n        let _ = &operator;\n        RWA::set_address_frozen(e, &user_address, freeze);',
    ],
    [
      '    fn freeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        RWA::freeze_partial_tokens(e, &user_address, amount);',
      '    fn freeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        let _ = &operator;\n        RWA::freeze_partial_tokens(e, &user_address, amount);',
    ],
    [
      '    fn unfreeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        RWA::unfreeze_partial_tokens(e, &user_address, amount);',
      '    fn unfreeze_partial_tokens(e: &Env, user_address: Address, amount: i128, operator: Address) {\n        let _ = &operator;\n        RWA::unfreeze_partial_tokens(e, &user_address, amount);',
    ],
    [
      '    fn set_compliance(e: &Env, compliance: Address, operator: Address) {\n        RWA::set_compliance(e, &compliance);',
      '    fn set_compliance(e: &Env, compliance: Address, operator: Address) {\n        let _ = &operator;\n        RWA::set_compliance(e, &compliance);',
    ],
    [
      '    fn set_identity_verifier(e: &Env, identity_verifier: Address, operator: Address) {\n        RWA::set_identity_verifier(e, &identity_verifier);',
      '    fn set_identity_verifier(e: &Env, identity_verifier: Address, operator: Address) {\n        let _ = &operator;\n        RWA::set_identity_verifier(e, &identity_verifier);',
    ],
  ] as const;

  return patches.reduce(
    (patched, [current, replacement]) => replaceExact(patched, current, replacement),
    source
  );
}

export function applyRwaTokenPatches(source: string, config: RWAConfig): string {
  let patched = source;
  const additionalRoles = getAdditionalRoles(config);

  if (additionalRoles.length > 0) {
    patched = insertAfterExact(
      patched,
      rwaTokenMarkers.roleConstant,
      buildAdditionalRoleSupport(additionalRoles)
    );
  }

  patched = patchConstructor(patched, config);
  patched = patchPausableGuards(patched, config);
  patched = patchRwaTokenGuards(patched, config);
  patched = markOperatorParametersUsed(patched);

  return patched;
}
