/**
 * Which config location the impact column is describing — the *inspected
 * anchor*.
 *
 * The third link in a one-directional chain: `config-path` (what a location is)
 * → `focused-path` (which location an element names) → `inspected-anchor` (which
 * location is the subject). A separate directory from `focused-path/` because
 * that one asserts, by exact set equality, that a single module in it touches
 * the global document — and this provider installs two more listeners. Making
 * room by weakening that assertion is the "silence the guard" move this
 * initiative keeps refusing; a new directory re-proves the same properties for
 * new code on its own terms instead.
 *
 * A curated surface, not a re-export dump: the store factory and the raw subject
 * key stay internal, because a caller that could store a key would re-introduce
 * the staleness the anchor removes.
 */
export { InspectedAnchorProvider } from './InspectedAnchorProvider';
export type { InspectedAnchorProviderProps } from './InspectedAnchorProvider';
export { useInspectAnchor, useInspectedConfigPath, useIsInspected } from './useInspectedAnchor';
