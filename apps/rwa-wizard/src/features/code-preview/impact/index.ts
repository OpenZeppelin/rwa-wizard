/**
 * Feature-internal surface for the drawer's field-impact column.
 *
 * Nothing here is re-exported from `features/code-preview/index.ts`: the column
 * is consumed only by `PreviewDrawerBody`, and keeping the surface closed is
 * what lets this sub-feature claim the feature's public API is unchanged.
 */
export { revealTargetFor } from './revealTargetFor';
export { toFieldImpactView, toImpactGroups } from './fieldImpactView';
export type {
  FieldImpactInput,
  FieldImpactView,
  ImpactGroupView,
  IndexedRow,
} from './fieldImpactView';
export { firstRangedSite, resolveActiveRangedSite, resolveActiveSite } from './firstRangedSite';
export type { ActiveImpactSite, RangedImpactSite } from './firstRangedSite';
export { resolveImpactSubject } from './impactSubject';
export type { ImpactSubjectInput } from './impactSubject';
export { humaniseConfigPath } from './humaniseConfigPath';
export type { HumanConfigPath } from './humaniseConfigPath';
export { splitDirectory, splitPath } from './splitPath';
export type { SplitDirectory, SplitPath } from './splitPath';
export { useFieldImpact } from './useFieldImpact';
export type { FieldImpactBinding, FieldImpactLatchProps } from './useFieldImpact';
