import type { ConfigPath, Observed, PatchSink } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { rwaTokenMarkers } from './rwa-token-markers';
import {
  buildAdditionalRoleGrants,
  buildAdditionalRoleParams,
  buildAdditionalRoleSupport,
  pausableGuardSignatures,
  rwaTokenGuardPatches,
} from './rwa-token-roles';
import type { AdditionalRole } from './rwa-token-roles';

/**
 * The config-derived values this patch family needs, each observed ONCE by the
 * top-level template and carried here with the paths that produced it.
 *
 * They are observed rather than recomputed because every one is used across
 * several edits: recomputing would attribute a role read to whichever edit came
 * next — the compute-early-emit-late hazard the `provenance/no-early-config-read`
 * rule exists to catch (INV-24).
 */
export interface RwaTokenPatchInputs {
  readonly additionalRoles: Observed<readonly AdditionalRole[]>;
  /** The pausable guard attribute, shared by every pausable signature. */
  readonly pauseGuard: Observed<string>;
  /** One guard attribute per entry of `rwaTokenGuardPatches`, in that order. */
  readonly tokenGuards: readonly Observed<string>[];
}

/**
 * Replace one upstream method guard while keeping the upstream method body intact.
 *
 * When the configured attribute already equals the upstream one, the bytes do
 * not move — but the edit is still issued, as `replaceExact(search, search)`.
 * Returning early would leave this guard's paths pending and hand them to the
 * NEXT edit, which is a different method entirely (INV-22).
 */
function replaceMethodGuard(
  sink: PatchSink,
  currentAttribute: string,
  signature: string,
  replacementAttribute: string,
  paths: readonly ConfigPath[]
): void {
  sink.replaceExact(
    `${currentAttribute}\n${signature}`,
    `${replacementAttribute}\n${signature}`,
    paths
  );
}

/**
 * Patch the upstream constructor in-place with configured decimals and extra roles.
 */
function patchConstructor(sink: PatchSink, config: RWAConfig, inputs: RwaTokenPatchInputs): void {
  // `config.token.decimals` is read HERE, at the edit it shapes, so it needs no
  // observation and cannot land on a neighbouring line.
  sink.replaceExact(
    rwaTokenMarkers.metadataLine,
    `        Base::set_metadata(e, ${config.token.decimals}, name, symbol);`
  );

  const { additionalRoles } = inputs;
  if (additionalRoles.value.length === 0) return;

  sink.insertAfterExact(
    rwaTokenMarkers.identityVerifierParam,
    buildAdditionalRoleParams(additionalRoles.value),
    additionalRoles.paths
  );
  sink.insertAfterExact(
    rwaTokenMarkers.managerRoleGrant,
    buildAdditionalRoleGrants(additionalRoles.value),
    additionalRoles.paths
  );
}

/** Patch Pausable guards without replacing the full upstream impl block. */
function patchPausableGuards(sink: PatchSink, inputs: RwaTokenPatchInputs): void {
  for (const signature of pausableGuardSignatures) {
    replaceMethodGuard(
      sink,
      rwaTokenMarkers.adminGuard,
      signature,
      inputs.pauseGuard.value,
      inputs.pauseGuard.paths
    );
  }
}

/**
 * Patch RWAToken method guards without replacing the full upstream impl block.
 *
 * Each guard carries only the paths of the role that shaped IT — the aliases are
 * observed one by one — so configuring one role never claims another role's
 * method (INV-34).
 */
function patchRwaTokenGuards(sink: PatchSink, inputs: RwaTokenPatchInputs): void {
  rwaTokenGuardPatches.forEach((patch, index) => {
    const guard = inputs.tokenGuards[index];
    if (guard === undefined) {
      throw new Error(`missing observed guard attribute for "${patch.signature}"`);
    }
    replaceMethodGuard(
      sink,
      rwaTokenMarkers.managerGuard,
      patch.signature,
      guard.value,
      guard.paths
    );
  });
}

/**
 * Make intentionally ABI-required operator parameters visibly used to Rust.
 *
 * Entirely static: reads no config, so these edits record nothing of their own.
 */
function markOperatorParametersUsed(sink: PatchSink): void {
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

  for (const [current, replacement] of patches) {
    sink.replaceExact(current, replacement);
  }
}

/** Apply every RWA token patch, in the original order. */
export function applyRwaTokenPatches(
  sink: PatchSink,
  config: RWAConfig,
  inputs: RwaTokenPatchInputs
): void {
  const { additionalRoles } = inputs;

  if (additionalRoles.value.length > 0) {
    sink.insertAfterExact(
      rwaTokenMarkers.roleConstant,
      buildAdditionalRoleSupport(additionalRoles.value),
      additionalRoles.paths
    );
  }

  patchConstructor(sink, config, inputs);
  patchPausableGuards(sink, inputs);
  patchRwaTokenGuards(sink, inputs);
  markOperatorParametersUsed(sink);
}
