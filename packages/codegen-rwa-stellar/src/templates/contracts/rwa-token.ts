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
import { replaceExact } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createBundledTemplateSource } from '../../upstream/providers/bundled';
import type { UpstreamTemplateSource } from '../../upstream/types';
import { addDocumentManagerSupport } from './rwa-token-document-manager';
import { applyRwaTokenPatches } from './rwa-token-patches';

const UPSTREAM_MACROS_IMPORT = 'use stellar_macros::{only_admin, only_role};';
const ADMIN_ONLY_MACROS_IMPORT = 'use stellar_macros::only_admin;';

/**
 * Generates the RWA Token contract source code (`contract.rs`).
 *
 * Uses the upstream example as the baseline, then patches the constructor and
 * optional extensions with generator-specific configuration values.
 */
export function generateRwaTokenContract(
  config: RWAConfig,
  templateSource: UpstreamTemplateSource = createBundledTemplateSource()
): string {
  let source = templateSource.getTemplate('core-contract', 'rwa-token');
  source = applyRwaTokenPatches(source, config);

  if (config.token.documentManager.enabled) {
    source = addDocumentManagerSupport(source, config);
  }

  return source.includes('#[only_role(')
    ? source
    : replaceExact(source, UPSTREAM_MACROS_IMPORT, ADMIN_ONLY_MACROS_IMPORT);
}
