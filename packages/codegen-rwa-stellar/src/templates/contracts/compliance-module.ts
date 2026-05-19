/**
 * Developer note:
 *
 * This file is not the canonical module contract template. The source of truth
 * lives in the upstream `stellar-contracts` module example loaded through the
 * active `UpstreamTemplateSource`.
 *
 * This wrapper exists only to apply local generator policy on top of the
 * upstream source, currently limited to the under-review warning banner for
 * modules that are not yet merged upstream.
 *
 * Drift is avoided by:
 * - always loading the upstream module source instead of keeping a local copy
 * - constraining local behavior to a small wrapper concern (the review banner)
 * - leaving the contract body itself untouched so upstream changes flow through
 *
 * Keep this layer minimal. If future module behavior diverges, prefer upstream
 * changes or narrowly scoped exact patches over replacing the upstream module
 * source with a handwritten local template.
 */
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

/**
 * Generates a compliance module `Cargo.toml` from the upstream example,
 * rewriting the package `name` to the wizard registry `crateName`.
 */
export function generateComplianceModuleCargoToml(
  entry: ComplianceModuleRegistryEntry,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  const source = templateSource.getTemplate('module-cargo', entry.id);
  return source.replace(/^name = ".*"$/m, `name = "${entry.crateName}"`);
}
