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

  return patched;
}
