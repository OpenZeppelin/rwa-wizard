import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';

/**
 * Generates the Identity Verifier contract source code (`contract.rs`).
 *
 * Uses the canonical upstream `stellar-contracts` example as the source of truth.
 * Reads no config, so it is emitted as scoped static content with empty paths.
 */
export function generateIdentityVerifierContract(
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  return templateSource.getTemplate('core-contract', 'identity-verifier');
}
