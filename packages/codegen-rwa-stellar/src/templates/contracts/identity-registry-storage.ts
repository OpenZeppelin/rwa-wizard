import { insertAfterExact, replaceExact } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';

const UPSTREAM_ACCESS_IMPORT = 'use stellar_access::access_control::{self as access_control};';

const UPSTREAM_COUNTRY_DATA_IMPL_END = `    fn delete_country_data(e: &Env, account: Address, index: u32, operator: Address) {
        identity_storage::delete_country_data(e, &account, index);
    }
}`;

/**
 * Generates the Identity Registry Storage (IRS) contract source code (`contract.rs`).
 *
 * Uses the canonical upstream `stellar-contracts` example as the source of truth.
 */
export function generateIdentityRegistryStorageContract(
  _config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  let source = templateSource.getTemplate('core-contract', 'identity-registry-storage');
  source = replaceExact(
    source,
    UPSTREAM_ACCESS_IMPORT,
    'use stellar_access::access_control::{self as access_control, AccessControl};'
  );

  return insertAfterExact(
    source,
    UPSTREAM_COUNTRY_DATA_IMPL_END,
    `\n\n#[contractimpl(contracttrait)]\nimpl AccessControl for IdentityRegistryContract {}\n`
  );
}
