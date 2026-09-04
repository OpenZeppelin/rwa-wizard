import {
  filterProvenanceByPath,
  isSecondaryAttribution,
  PROVENANCE_AND_DOCS_KIND,
} from '@openzeppelin/codegen-core';
import type { ProvenanceEntry } from '@openzeppelin/codegen-core';

import type { ConfigPath } from '../../../features/wizard/config-path';
import type {
  FieldProvenanceResult,
  FieldProvenanceRow,
  FileProvenanceGroup,
  PreviewProvenanceSource,
} from './types';

const HIDDEN_KIND = PROVENANCE_AND_DOCS_KIND;

/**
 * One row per site. Ranges are the sites, so when any matched they suppress
 * the whole-file row (the `file` entry's paths include every range's paths by
 * SF-1 construction, and would otherwise always duplicate). Otherwise a
 * `created` entry outranks the `file` entry. SF-5 INV-14.
 *
 * SF-11 adds exactly one thing: the significance the generator declared. Which
 * rows exist, and their order, are untouched — significance is metadata on a
 * row that was already going to be there. SF-11 INV-1.
 */
function toRows(matched: readonly ProvenanceEntry[], path: ConfigPath): FieldProvenanceRow[] {
  const ranges: Extract<FieldProvenanceRow, { kind: 'range' }>[] = [];
  let created = false;
  for (const entry of matched) {
    if (entry.kind === 'range') {
      // Fresh object: a consumer mutating a row cannot reach the package's data. INV-24.
      ranges.push({
        kind: 'range',
        range: { startLine: entry.range.start, endLine: entry.range.end },
        // The one significance read in the whole wizard, and it is a read
        // rather than a decision: core owns the rule. `path` is the QUERY,
        // not the entry's own paths — the same emitted line is primary for one
        // field and secondary for another, and core answers per attribution.
        // Both inline shortcuts are wrong in opposite directions, which is why
        // this asks core rather than reading the marks. SF-11 INV-1, INV-10.
        significance: isSecondaryAttribution(entry, path) ? 'secondary' : 'primary',
      });
    } else if (entry.kind === 'created') {
      created = true;
    }
  }
  if (ranges.length > 0) {
    return ranges.sort(
      (a, b) => a.range.startLine - b.range.startLine || a.range.endLine - b.range.endLine
    );
  }
  // Whole-file and file-creation rows are `'primary'` by their type, not by a
  // default applied here: there is no absent state on this side to coalesce.
  return [
    created
      ? { kind: 'created', significance: 'primary' }
      : { kind: 'file', significance: 'primary' },
  ];
}

/**
 * The answer for one wizard field against one generation. Pure; never reads
 * the draft config; never throws for a `ConfigPath` produced by the SF-6
 * builders and a loader-narrowed `ProvenanceResult`.
 *
 * That never-throws promise now rests on a STRONGER property of the loader than
 * it did before SF-11, so the dependency is named rather than left implicit:
 * `isSecondaryAttribution` selects matching paths eagerly and so parses EVERY
 * path of an entry, where `filterProvenanceByPath` short-circuits on the first
 * match. An entry whose first path matches the query and whose third path is
 * malformed is survivable under the `.some` rule and would raise a
 * `RangeError` under the `.filter` one. The
 * closure is `hasParsablePaths` in the loader, which parses the full
 * `entry.paths` and drops the entry whole on any failure (SF-5 INV-3 / INV-7).
 * Stop parsing eagerly there and every field lookup on the affected generation
 * fails inside render. SF-11 INV-13.
 *
 * 1. Core's matching rule, applied once (INV-10).
 * 2. Drop files whose key is not an own key of `source.files` (INV-5).
 * 3. Drop files the generator classifies as `provenance-and-docs` (INV-13).
 * 4. One row per site (INV-14).
 * 5. Groups sorted by path in code-unit order (INV-15).
 */
export function groupFieldProvenance(
  source: PreviewProvenanceSource,
  path: ConfigPath
): FieldProvenanceResult {
  const matched = filterProvenanceByPath(source.provenance, path);
  const groups: FileProvenanceGroup[] = [];

  for (const [filePath, fileProvenance] of Object.entries(matched.files)) {
    // Own-key membership, never a property read: content is not consulted (INV-23);
    // `in` would admit `"constructor"` on an empty tree. `Object.hasOwn` is ES2022; `lib` is ES2020.
    if (!Object.prototype.hasOwnProperty.call(source.files, filePath)) continue;
    const kind = source.kindOf(filePath);
    if (kind === HIDDEN_KIND) continue;
    groups.push({ path: filePath, kind, rows: toRows(fileProvenance.entries, path) });
  }

  groups.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { identity: source.identity, path, groups };
}
