import type { PatchSink, ProvenanceScope } from '@openzeppelin/codegen-core';
import { createPatchBuilder } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';
import { renderDetached } from './detached-scope';

export const IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH =
  'contracts/identity-registry-storage/src/contract.rs';

const UPSTREAM_ACCESS_IMPORT = 'use stellar_access::access_control::{self as access_control};';

const UPSTREAM_COUNTRY_DATA_IMPL_END = `    fn delete_country_data(e: &Env, account: Address, index: u32, operator: Address) {
        identity_storage::delete_country_data(e, &account, index);
    }
}`;

/**
 * The base IRS patch sequence, in its original order.
 *
 * Both edits are unconditional and read no config, so they record no paths —
 * the IRS's honest answer is an empty `file` entry (INV-36). It goes through a
 * `PatchSink` regardless, because the identity path must REPLAY this exact
 * sequence from upstream before applying its own edits (INV-22), and because a
 * config-driven IRS patch added later then lands in the right place by
 * construction.
 */
export function applyIdentityRegistryStoragePatches(sink: PatchSink): void {
  sink.replaceExact(
    UPSTREAM_ACCESS_IMPORT,
    'use stellar_access::access_control::{self as access_control, AccessControl};'
  );
  sink.insertAfterExact(
    UPSTREAM_COUNTRY_DATA_IMPL_END,
    `\n\n#[contractimpl(contracttrait)]\nimpl AccessControl for IdentityRegistryContract {}\n`
  );
}

/** The upstream IRS source every variant starts from. */
export function getIdentityRegistryStorageSource(templateSource: UpstreamTemplateSource): string {
  return templateSource.getTemplate('core-contract', 'identity-registry-storage');
}

/**
 * Generates the Identity Registry Storage (IRS) contract source code (`contract.rs`).
 *
 * Uses the canonical upstream `stellar-contracts` example as the source of truth.
 */
export function generateIdentityRegistryStorageContractInScope(
  scope: ProvenanceScope<RWAConfig>,
  templateSource: UpstreamTemplateSource
): string {
  // INV-17: the builder is the first thing that touches the scope.
  const patcher = createPatchBuilder(scope, getIdentityRegistryStorageSource(templateSource));
  applyIdentityRegistryStoragePatches(patcher);
  return patcher.text();
}

export function generateIdentityRegistryStorageContract(
  config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  return renderDetached(config, IDENTITY_REGISTRY_STORAGE_CONTRACT_PATH, (scope) =>
    generateIdentityRegistryStorageContractInScope(scope, templateSource)
  );
}
