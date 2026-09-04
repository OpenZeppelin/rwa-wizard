import type { FieldProvenanceRow } from '../../../services/preview';
import type { ConfigPath } from '../../wizard/config-path';
import type { PreviewLineRange } from '../reveal';
import type { ImpactGroupView } from './fieldImpactView';

/**
 * The site the column treats as selected for a subject: identity by
 * (configPath, filePath, rowIndex), never by absolute line numbers.
 * Line numbers move under regeneration; the site does not (SF-13 DeferredRange).
 */
export interface ActiveImpactSite {
  readonly configPath: ConfigPath;
  readonly filePath: string;
  /** `IndexedRow.rowIndex` — unpartitioned position in that file's rows. */
  readonly rowIndex: number;
  /** Row kind at activation — prevents auto-select from overriding file/created clicks. */
  readonly rowKind: FieldProvenanceRow['kind'];
}

/**
 * What auto-select / activation needs to call `onReveal` (or defer).
 * `range` is carried so the non-stale path does not re-look the row up.
 */
export interface RangedImpactSite {
  readonly filePath: string;
  readonly rowIndex: number;
  readonly range: PreviewLineRange;
}

/**
 * First `kind === 'range'` row in **display order**:
 * groups array order → each group's `primary` then `secondary`, each in array order.
 * Returns null when no ranged row exists (AS-3 / INV-4 / INV-10).
 *
 * Primary-before-secondary matches SF-13's subtractive presentation: the first
 * thing the eye meets in the column is the first candidate for auto-select.
 */
export function firstRangedSite(groups: readonly ImpactGroupView[]): RangedImpactSite | null {
  for (const group of groups) {
    for (const indexed of group.primary) {
      if (indexed.row.kind === 'range') {
        return {
          filePath: group.path,
          rowIndex: indexed.rowIndex,
          range: indexed.row.range,
        };
      }
    }
    for (const indexed of group.secondary) {
      if (indexed.row.kind === 'range') {
        return {
          filePath: group.path,
          rowIndex: indexed.rowIndex,
          range: indexed.row.range,
        };
      }
    }
  }
  return null;
}

/**
 * Resolve an ActiveImpactSite against current groups.
 * Returns the row when (filePath, rowIndex) still names the same kind; otherwise null.
 */
export function resolveActiveSite(
  groups: readonly ImpactGroupView[],
  site: ActiveImpactSite
): {
  readonly filePath: string;
  readonly rowIndex: number;
  readonly row: FieldProvenanceRow;
} | null {
  const group = groups.find((candidate) => candidate.path === site.filePath);
  if (group === undefined) return null;

  const entry =
    group.primary.find((indexed) => indexed.rowIndex === site.rowIndex) ??
    group.secondary.find((indexed) => indexed.rowIndex === site.rowIndex);

  if (entry === undefined || entry.row.kind !== site.rowKind) return null;

  return {
    filePath: site.filePath,
    rowIndex: site.rowIndex,
    row: entry.row,
  };
}

/**
 * Resolve an ActiveImpactSite against current groups.
 * Returns the ranged site when that (filePath, rowIndex) still names a `range` row;
 * otherwise null (site gone or no longer a range). INV-5.
 */
export function resolveActiveRangedSite(
  groups: readonly ImpactGroupView[],
  site: ActiveImpactSite
): RangedImpactSite | null {
  const group = groups.find((candidate) => candidate.path === site.filePath);
  if (group === undefined) return null;

  const entry =
    group.primary.find((indexed) => indexed.rowIndex === site.rowIndex) ??
    group.secondary.find((indexed) => indexed.rowIndex === site.rowIndex);

  if (entry === undefined || entry.row.kind !== 'range') return null;

  return {
    filePath: site.filePath,
    rowIndex: site.rowIndex,
    range: entry.row.range,
  };
}
