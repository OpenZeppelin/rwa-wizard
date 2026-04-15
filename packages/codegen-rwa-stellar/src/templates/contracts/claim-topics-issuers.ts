import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';

/**
 * Generates the Claim Topics & Issuers (CTI) contract source code (`contract.rs`).
 *
 * Uses the canonical upstream `stellar-contracts` example as the source of truth.
 */
export function generateClaimTopicsIssuersContract(
  _config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  return templateSource.getTemplate('core-contract', 'claim-topics-issuers');
}
