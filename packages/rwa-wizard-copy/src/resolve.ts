import { EVM_OVERRIDE } from './overrides/evm';
import { STELLAR_OVERRIDE } from './overrides/stellar';

import { CORE_DICT } from './core';
import type {
  ChainId,
  ConceptCategory,
  ConceptDictionary,
  ConceptEntry,
  ConceptOverride,
} from './types';

const OVERRIDES: Readonly<Record<ChainId, ConceptOverride>> = {
  stellar: STELLAR_OVERRIDE,
  evm: EVM_OVERRIDE,
};

/**
 * Apply a per-chain override on top of the chain-neutral core.
 *
 * Override entries shallow-merge onto the matching core entry — any field
 * the override defines (`title`, `description`, `infoCopy`) replaces the
 * core's, while the stable `id` is preserved.
 *
 * Override entries whose id does *not* exist in core are allowed through
 * and introduced as new entries. This is deliberate: some concepts
 * (target identity, future chain-only compliance modules) only exist on a
 * specific chain, and forcing them into core would require inventing fake
 * chain-neutral copy. The consumer-side coverage test (the wizard's
 * `enrichEcosystemMetadata` tests) prevents the inverse drift — codegen
 * emitting ids that are missing from the dictionary.
 */
function mergeDict(core: ConceptDictionary, override: ConceptOverride): ConceptDictionary {
  const merged: Record<string, ConceptEntry> = { ...core };
  for (const [id, patch] of Object.entries(override)) {
    const base = merged[id];
    if (base) {
      merged[id] = { ...base, ...patch, id: base.id };
    } else {
      merged[id] = { id, description: '', ...patch };
    }
  }
  return merged;
}

/**
 * Look up a concept by category-scoped id. Returns a best-effort placeholder
 * entry on miss rather than throwing, so a single missing id never crashes
 * the wizard. The consumer-side coverage tests catch gaps at build time.
 */
function lookup(dict: ConceptDictionary, category: ConceptCategory, id: string): ConceptEntry {
  const key = `${category}.${id}`;
  const entry = dict[key];
  if (!entry) {
    if (typeof console !== 'undefined') {
      // Intentional dev signal: a missing concept id means the codegen
      // package (or a hand-written call site) asked for copy this dictionary
      // does not yet cover.
      // eslint-disable-next-line no-console
      console.warn(`[rwa-wizard-copy] missing entry for "${key}"`);
    }
    return { id: key, description: '' };
  }
  return entry;
}

/**
 * Category-scoped accessors returned from `getCopyForChain`. Typed
 * explicitly so call sites can destructure only the categories they need
 * and catch typos at compile time.
 *
 * Accessors are split into two groups for readability:
 *
 *   • Chain-scoped (admin, identity, role, hook, module, moduleField,
 *     target) — may legitimately differ per chain.
 *   • Chain-neutral (wizardStep, section, fieldHelper, notice,
 *     ownershipModel, verificationApproach) — identical across chains
 *     today, but still resolved through this interface so a future chain
 *     can override without touching call sites.
 */
export interface ChainCopy {
  adminControl: (id: string) => ConceptEntry;
  identityControl: (id: string) => ConceptEntry;
  role: (id: string) => ConceptEntry;
  hook: (id: string) => ConceptEntry;
  module: (id: string) => ConceptEntry;
  moduleField: (moduleId: string, fieldKey: string) => ConceptEntry;
  target: (id: string) => ConceptEntry;
  wizardStep: (id: string) => ConceptEntry;
  section: (id: string) => ConceptEntry;
  fieldHelper: (id: string) => ConceptEntry;
  notice: (id: string) => ConceptEntry;
  ownershipModel: (id: string) => ConceptEntry;
  verificationApproach: (id: string) => ConceptEntry;
}

function buildChainCopy(dict: ConceptDictionary): ChainCopy {
  return {
    adminControl: (id) => lookup(dict, 'admin', id),
    identityControl: (id) => lookup(dict, 'identity', id),
    role: (id) => lookup(dict, 'role', id),
    hook: (id) => lookup(dict, 'hook', id),
    module: (id) => lookup(dict, 'module', id),
    moduleField: (moduleId, fieldKey) => lookup(dict, 'moduleField', `${moduleId}.${fieldKey}`),
    target: (id) => lookup(dict, 'target', id),
    wizardStep: (id) => lookup(dict, 'wizardStep', id),
    section: (id) => lookup(dict, 'section', id),
    fieldHelper: (id) => lookup(dict, 'fieldHelper', id),
    notice: (id) => lookup(dict, 'notice', id),
    ownershipModel: (id) => lookup(dict, 'ownershipModel', id),
    verificationApproach: (id) => lookup(dict, 'verificationApproach', id),
  };
}

/**
 * Resolve the copy dictionary for a chain family and return category-scoped
 * accessors. Consumers call this once per target-load and reuse the result.
 */
export function getCopyForChain(chainId: ChainId): ChainCopy {
  return buildChainCopy(mergeDict(CORE_DICT, OVERRIDES[chainId] ?? {}));
}

/**
 * Core-only accessors — every chain-neutral category resolved without any
 * override. Convenient for call sites outside the target-scoped wizard
 * (e.g. dashboard prose) that would otherwise need a chain id just to
 * read copy that is identical on every chain.
 */
export const coreCopy: ChainCopy = buildChainCopy(CORE_DICT);

/**
 * Substitute `{placeholder}` tokens inside a copy string. Only the subset
 * of entries that reference a runtime value (e.g. a validation max-length
 * pulled from `@openzeppelin/rwa-config`) uses this — everything else is
 * rendered verbatim.
 */
export function formatCopy(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}
