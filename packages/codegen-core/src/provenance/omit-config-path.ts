/**
 * Exact-path omit for emit attribution lists.
 *
 * Emit-path hygiene only: drop a recorded path by string identity before the
 * list reaches an emission. Never a matching tweak and never an automatic
 * post-drain filter — call sites decide whether a list root was a lookup or a
 * true whole-list dependence.
 *
 * @see docs/codegen-core/provenance/attribution-hazards.md — hazard 5 (list scan)
 */

import type { ConfigPath } from './types';

/**
 * Drop every occurrence of `path` from `paths` by exact string equality.
 *
 * - Exact only: `'members'` does not remove `'members[0].addresses'`.
 * - Does not parse, does not call `matchesConfigPath`, does not mutate `paths`.
 * - When `path` is absent, returns `paths` by reference (identity no-op).
 * - When at least one entry is removed, returns a fresh array preserving relative order
 *   of the survivors (and therefore preserving sort if the input was sorted).
 *
 * Use after a list scan that only needed a match: omit the list root before the
 * path list reaches an emit. Do not omit when the emit depends on the whole list.
 *
 * @see docs/codegen-core/provenance/attribution-hazards.md — hazard 5 (list scan)
 */
export function omitExactConfigPath(
  paths: readonly ConfigPath[],
  path: ConfigPath
): readonly ConfigPath[] {
  // INV-3 / INV-7 / INV-8: absent path (or empty list) → same reference; never throws.
  if (!paths.includes(path)) return paths;

  // INV-1 / INV-2 / INV-4 / INV-5 / INV-6 / INV-14: === filter into a fresh array; no parse.
  return paths.filter((entry) => entry !== path);
}
