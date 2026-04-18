/**
 * Canonical, ordered list of chain families the wizard targets. This is the
 * single source of truth — every other "which chains do we support?"
 * consumer in the repo (target registry, context providers, tests) derives
 * from this constant rather than re-declaring the set.
 *
 * Ordering is meaningful: it is also the default display order in the
 * target selector.
 *
 * Note: this is intentionally coarser than a full network list (we do not
 * distinguish mainnet vs testnet here) — T-REX educational copy does not
 * vary between networks on the same chain.
 */
export const CHAIN_IDS = ['stellar', 'evm'] as const;

/** Chain families the wizard targets. Derived from {@link CHAIN_IDS}. */
export type ChainId = (typeof CHAIN_IDS)[number];

/** Type guard that narrows an arbitrary string to a known {@link ChainId}. */
export function isChainId(value: string): value is ChainId {
  return (CHAIN_IDS as readonly string[]).includes(value);
}

/**
 * Concept categories carried by the dictionary. Kept as a literal union so
 * `getCopyForChain` can expose a typesafe category-scoped accessor per entry
 * without resorting to stringly-typed dotted lookups at call sites.
 *
 * Categories split naturally into two groups:
 *
 *   • Chain-scoped — concepts whose wording can legitimately differ across
 *     chains (admin, identity, role, hook, module, moduleField, target).
 *     These always go through `getCopyForChain(chainId)` and the enrichment
 *     seam in the app layer.
 *
 *   • Chain-neutral — app-shell prose that is identical everywhere
 *     (wizardStep, section, fieldHelper, notice, ownershipModel,
 *     verificationApproach). Overrides are still *allowed* for these (the
 *     mechanism is the same), but in practice only the `core` dictionary
 *     carries them.
 */
export type ConceptCategory =
  | 'admin'
  | 'identity'
  | 'role'
  | 'hook'
  | 'module'
  | 'moduleField'
  | 'target'
  | 'wizardStep'
  | 'section'
  | 'fieldHelper'
  | 'notice'
  | 'ownershipModel'
  | 'verificationApproach';

/**
 * One piece of educational copy keyed by concept id.
 *
 * - `id` is the stable key used to join this entry with structural metadata
 *   emitted by codegen packages (`admin.burnable`, `identity.recovery`, ...)
 *   or with a fixed call site (`section.token-information`, ...).
 * - `title` is an optional display title; used by call sites that need a
 *   stable card/step heading separate from the short one-line
 *   `description`. Omit when the surrounding component owns the title.
 * - `description` is the short, always-visible prose rendered beneath the
 *   title — the primary, one-line explanation the user sees.
 * - `infoCopy` is the deeper educational prose surfaced behind an info-icon
 *   tooltip. Must add context beyond `description` — trigger scenarios,
 *   compliance hooks fired, role interactions, edge cases. Omit entirely
 *   rather than duplicate `description`.
 */
export interface ConceptEntry {
  id: string;
  title?: string;
  description: string;
  infoCopy?: string;
}

/** Full concept dictionary, keyed by concept id (e.g. `admin.burnable`). */
export type ConceptDictionary = Readonly<Record<string, ConceptEntry>>;

/**
 * Partial patch applied on top of the chain-neutral core for a single chain.
 * Each entry can override any subset of a concept's fields without having to
 * re-declare unchanged ones.
 */
export type ConceptOverride = Readonly<Record<string, Partial<Omit<ConceptEntry, 'id'>>>>;
