import type { FieldProvenanceRow } from '../../../services/preview';
import type { CodePreviewRevealTarget } from '../reveal';

/**
 * What activation sends, determined by `row.kind` and nothing else.
 *
 * A `created` row **never** synthesises a line jump: telling the user the field
 * created the file *at line 1* is a claim the generator never made, and it is
 * wrong for every file whose first line is a licence header. AS-2, INV-19.
 *
 * The `range` key is present only in the `range` arm — omitted, not set to
 * `undefined` — so `'range' in target` is a truthful test.
 */
export function revealTargetFor(path: string, row: FieldProvenanceRow): CodePreviewRevealTarget {
  return row.kind === 'range' ? { path, range: row.range } : { path };
}
