import type { GenerationResult } from '../types';
import { matchesConfigPathSegments, parseConfigPath } from './config-path';
import { PROVENANCE_ENTRY_KINDS } from './types';
import type { ConfigPath, FileProvenance, ProvenanceEntry, ProvenanceResult } from './types';

/** The narrowed result `hasProvenance` produces. */
export type ProvenanceGenerationResult = GenerationResult & {
  readonly provenance: ProvenanceResult;
};

const isObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Presence test for the capability on a result: `provenance` is a non-null
 * object with an own `files` object. Never throws; does not validate entries —
 * that is `isProvenanceEntry`'s job at the consumer's narrowing point.
 */
export function hasProvenance(result: GenerationResult): result is ProvenanceGenerationResult {
  const provenance: unknown = result.provenance;
  if (!isObject(provenance)) return false;
  if (!Object.prototype.hasOwnProperty.call(provenance, 'files')) return false;
  // An array is an object, but it is not the keyed-by-file-path map the shape
  // promises; a consumer iterating `Object.entries` would see index keys.
  return isObject(provenance.files) && !Array.isArray(provenance.files);
}

function isPathList(value: unknown): value is readonly ConfigPath[] {
  return Array.isArray(value) && value.every((path) => typeof path === 'string');
}

function isLineRange(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { start, end } = value;
  return (
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 1 &&
    end >= start
  );
}

/**
 * Structural guard for one entry; `false` on unknown `kind` or malformed shape.
 * Never throws — it is the one function designed to be fed untrusted shapes.
 */
export function isProvenanceEntry(value: unknown): value is ProvenanceEntry {
  if (!isObject(value) || Array.isArray(value)) return false;
  // INV-6: a hostile getter on `kind`, `paths` or `range` is a malformed entry, not an exception.
  try {
    const { kind, paths } = value;
    if (typeof kind !== 'string' || !(PROVENANCE_ENTRY_KINDS as readonly string[]).includes(kind)) {
      return false;
    }
    if (!isPathList(paths)) return false;
    return kind !== 'range' || isLineRange(value.range);
  } catch {
    return false;
  }
}

/**
 * Combine provenance results the way `mergeFileTrees` combines trees: later
 * arguments win per file key, wholesale; keys only in earlier results are kept;
 * key order is the first result's keys followed by each later result's new keys.
 * Inputs are never mutated; the return value is always a fresh object.
 */
export function mergeProvenance(...results: readonly ProvenanceResult[]): ProvenanceResult {
  const files: Record<string, FileProvenance> = {};
  for (const result of results) {
    for (const [filePath, fileProvenance] of Object.entries(result.files)) {
      files[filePath] = fileProvenance;
    }
  }
  return { files };
}

/**
 * Is this entry's attribution to `query` secondary — displayed rather than
 * determined?
 *
 * `true` only when the entry is a marked `range` AND it matches `query` AND
 * EVERY matching path is secondary. A `file` or `created` entry, an unmarked
 * range, an entry that matches nothing, and an entry with any primary matching
 * path all return `false`.
 *
 * Matching is `matchesConfigPath`'s rule, so a prefix query (`token`) answers
 * over every recorded path beneath it and a recorded ancestor answers a
 * descendant query. Throws `RangeError` on a malformed `query` or recorded
 * path, like `filterProvenanceByPath`.
 *
 * This rule lives here, once, because both inline shortcuts are wrong in
 * opposite directions: `secondaryPaths.length > 0` demotes a range that
 * determines a sibling path, and `secondaryPaths.includes(query)` promotes
 * everything a prefix query reaches. Consumers read significance; they never
 * compute it.
 */
export function isSecondaryAttribution(entry: ProvenanceEntry, query: ConfigPath): boolean {
  // Parsed first, so a malformed query is a `RangeError` for every entry kind.
  const querySegments = parseConfigPath(query);
  if (entry.kind !== 'range') return false;
  const { secondaryPaths } = entry;
  if (secondaryPaths === undefined) return false;

  const matching = entry.paths.filter((path) =>
    matchesConfigPathSegments(parseConfigPath(path), querySegments)
  );
  const secondary = new Set(secondaryPaths);
  // The non-empty guard is the invariant, not a nicety: `every` over an empty
  // set is `true`, so without it an entry matching nothing comes back secondary
  // and silently demotes every row the UI is handed.
  return matching.length > 0 && matching.every((path) => secondary.has(path));
}

/**
 * Entries relevant to one queried config path, per file, using
 * `matchesConfigPath`. Files with no matching entry are omitted; a matching
 * file keeps only its matching entries, each returned by identity, in input
 * order. An entry with empty `paths` matches no query, including the root.
 * Throws `RangeError` on a malformed `query` or recorded path.
 */
export function filterProvenanceByPath(
  result: ProvenanceResult,
  query: ConfigPath
): ProvenanceResult {
  const querySegments = parseConfigPath(query);
  const matches = (path: ConfigPath): boolean =>
    matchesConfigPathSegments(parseConfigPath(path), querySegments);

  const files: Record<string, FileProvenance> = {};
  for (const [filePath, fileProvenance] of Object.entries(result.files)) {
    const entries = fileProvenance.entries.filter((entry) => entry.paths.some(matches));
    if (entries.length > 0) files[filePath] = { entries };
  }
  return { files };
}
