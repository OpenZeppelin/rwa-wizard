import type { ComplianceModuleRegistryEntry } from '../../modules/registry';
import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import { prependRustCommentBanner } from '../../upstream/render-utils';
import type { UpstreamTemplateSource } from '../../upstream/types';

/**
 * Generates a compliance module contract source file (`contract.rs`).
 *
 * Uses the canonical upstream `stellar-contracts` module example as the source of truth.
 */
export function generateComplianceModuleContract(
  entry: ComplianceModuleRegistryEntry,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  const source = templateSource.getTemplate('module-contract', entry.id);
  if (entry.review.state !== 'under-review') {
    return source;
  }

  const bannerLines = [
    'WARNING: This compliance module is under review and not yet merged upstream.',
    'Do NOT use in production until the review is complete.',
  ];
  if (entry.review.prUrl) {
    bannerLines.push(`Review PR: ${entry.review.prUrl}`);
  }

  return prependRustCommentBanner(source, bannerLines);
}
