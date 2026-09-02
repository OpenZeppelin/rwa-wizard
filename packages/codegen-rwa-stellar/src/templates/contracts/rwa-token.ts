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
import type { ProvenanceScope } from '@openzeppelin/codegen-core';
import { createPatchBuilder } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';
import { renderDetached } from './detached-scope';
import { addDocumentManagerSupport } from './rwa-token-document-manager';
import { applyRwaTokenPatches } from './rwa-token-patches';
import {
  buildAccessAttribute,
  buildDocumentManagerAccessAttribute,
  getAdditionalRoles,
  rwaTokenGuardPatches,
  rwaTokenRoleAliases,
  withoutRolesListRoot,
} from './rwa-token-roles';

export const RWA_TOKEN_CONTRACT_PATH = 'contracts/rwa-token/src/contract.rs';

const UPSTREAM_MACROS_IMPORT = 'use stellar_macros::{only_admin, only_role};';
const ADMIN_ONLY_MACROS_IMPORT = 'use stellar_macros::only_admin;';

/**
 * Generates the RWA Token contract source code (`contract.rs`).
 *
 * Uses the upstream example as the baseline, then patches the constructor and
 * optional extensions with generator-specific configuration values.
 *
 * This is the only core contract that reads config, so it is the only one that
 * builds a patch builder rather than returning upstream text unchanged.
 */
export function generateRwaTokenContractInScope(
  scope: ProvenanceScope<RWAConfig>,
  templateSource: UpstreamTemplateSource
): string {
  // INV-17: first toucher of the scope, before any config is read.
  const patcher = createPatchBuilder(
    scope,
    templateSource.getTemplate('core-contract', 'rwa-token')
  );

  // INV-24: every value used across more than one edit is observed once, and its
  // paths travel to each edit it shapes. Guard attributes are observed one per
  // method, so a role never claims a method it did not configure.
  //
  // INV-5: additionalRoles is a whole-list read — keep the roles-list root.
  const additionalRoles = patcher.observe((config) => getAdditionalRoles(config));
  // INV-4 / INV-13 / hazard 5: observe → omit list root → emit. Name-match
  // role-guard scans must not leave `accessControl.roles` on the path list.
  const pauseGuard = withoutRolesListRoot(
    patcher.observe((config) => buildAccessAttribute(config, rwaTokenRoleAliases.pauser, '_caller'))
  );
  const tokenGuards = rwaTokenGuardPatches.map((patch) =>
    withoutRolesListRoot(
      patcher.observe((config) => buildAccessAttribute(config, patch.aliases, 'operator'))
    )
  );
  const documentManagerEnabled = patcher.observe((config) => config.token.documentManager.enabled);

  applyRwaTokenPatches(patcher, patcher.config, { additionalRoles, pauseGuard, tokenGuards });

  if (documentManagerEnabled.value) {
    const documentManagerGuard = withoutRolesListRoot(
      patcher.observe((config) => buildDocumentManagerAccessAttribute(config))
    );
    addDocumentManagerSupport(
      patcher,
      documentManagerGuard.value,
      documentManagerEnabled.paths,
      documentManagerGuard.paths
    );
  }

  // The upstream import is narrowed only when no configured role produced an
  // `only_role` guard, so this edit is shaped by the guard configuration and
  // carries exactly the paths consulted to build those guards.
  if (!patcher.current.includes('#[only_role(')) {
    patcher.replaceExact(UPSTREAM_MACROS_IMPORT, ADMIN_ONLY_MACROS_IMPORT, [
      ...pauseGuard.paths,
      ...tokenGuards.flatMap((guard) => guard.paths),
    ]);
  }

  return patcher.text();
}

export function generateRwaTokenContract(
  config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  return renderDetached(config, RWA_TOKEN_CONTRACT_PATH, (scope) =>
    generateRwaTokenContractInScope(scope, templateSource)
  );
}
