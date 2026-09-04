import type { FileTree, ProvenanceResult } from '@openzeppelin/codegen-core';

import type { PreviewLineRange } from '../../../features/code-preview/reveal';
import type { ConfigPath } from '../../../features/wizard/config-path';
import type { StructuralGeneratedFileKind } from '../../../types/wizard';

/**
 * Identity of one preview generation: the hook's generate key. Its inputs are
 * enumerated once in `useCodePreview.computeGenerateKey` — filled-config hash
 * (which carries the module catalog), `includeIdentitySupport`, service
 * identity. Plain string, not branded: SF-9 threads the same value as
 * `treeKey` and only ever compares it with `===`. SF-5 INV-17.
 */
export type PreviewGenerateKey = string;

/**
 * What the generator declared about one attribution: is this the determining
 * site for the queried path, or does it merely show the value?
 *
 * Never computed here. Produced once, in `groupFieldProvenance`, by asking
 * core's `isSecondaryAttribution`. There is no third state and no absent state:
 * SF-10's default-primary guarantee is spent at the seam, so everything
 * downstream reads a value that is always present and never coalesces one in.
 * SF-11 INV-1, INV-8.
 */
export type FieldProvenanceSignificance = 'primary' | 'secondary';

/** One activatable site inside one generated file. SF-5 INV-14, extended by SF-11 INV-8. */
export type FieldProvenanceRow =
  /**
   * The file as a whole depends on the field; open it, mark nothing. Typed to
   * the literal `'primary'`, not to the union: SF-10 refused significance on
   * whole-file attributions, and this is that refusal as a `tsc` fact rather
   * than a convention the wizard has to remember. SF-11 INV-8.
   */
  | { readonly kind: 'file'; readonly significance: 'primary' }
  /** The field decided that this file exists at all; open it, mark nothing. */
  | { readonly kind: 'created'; readonly significance: 'primary' }
  /** These lines were produced from the field; open and reveal `range`. */
  | {
      readonly kind: 'range';
      readonly range: PreviewLineRange;
      readonly significance: FieldProvenanceSignificance;
    };

/** Rows for one file. `rows` is non-empty; a file with nothing to show is omitted. */
export interface FileProvenanceGroup {
  readonly path: string;
  /** Generator-reported kind, `unknown` when the service does not classify. For consumer ordering. */
  readonly kind: StructuralGeneratedFileKind;
  /** Canonical order: the single `created` | `file` row, or `range` rows by `startLine`. */
  readonly rows: readonly FieldProvenanceRow[];
}

/**
 * The answer for one field against one generation. `groups.length === 0` is
 * the explicit "no generated file depends on this field" — distinct from the
 * capability being absent (`PreviewProvenanceState.kind !== 'available'`) and
 * from generation having failed (no ready phase, so no state to query). SF-5 INV-8.
 */
export interface FieldProvenanceResult {
  readonly identity: PreviewGenerateKey;
  readonly path: ConfigPath;
  readonly groups: readonly FileProvenanceGroup[];
}

/**
 * Everything the pure grouper reads. Built by the hook from one tick's
 * result. Deliberately has no config member: the answer is a function of
 * recorded paths alone, so an absent optional member is queried exactly like a
 * present one. SF-5 INV-11.
 */
export interface PreviewProvenanceSource {
  readonly identity: PreviewGenerateKey;
  /** The tree on screen; provenance keys not in it are dropped. Read for key membership only. */
  readonly files: FileTree;
  /** Already narrowed by the loader: every recorded path parses. */
  readonly provenance: ProvenanceResult;
  /** `service.getGeneratedFileKind ?? () => 'unknown'`. */
  readonly kindOf: (path: string) => StructuralGeneratedFileKind;
}
