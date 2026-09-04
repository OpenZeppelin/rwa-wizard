/**
 * Provenance types: which config paths each generated file was produced from.
 *
 * Structural only. Nothing here names a chain, a file, a field or the consuming
 * app; the vocabulary is a config path string, a generated-file relative
 * path and a 1-indexed inclusive line range.
 */

/**
 * A config property path in the validation dialect already used by
 * `ValidationError.field`: dot-separated keys, numeric indices in brackets.
 *
 * - `'settings.name'`
 * - `'members[1].address'`
 * - `'items[0].config.limit'`
 *
 * The empty string is the root: the whole config was read.
 */
export type ConfigPath = string;

/** Sentinel for "the whole config". Matches every query. */
export const ROOT_CONFIG_PATH: ConfigPath = '';

/** One step of a path. Keys are emitted verbatim; indices are non-negative integers. */
export type ConfigPathSegment =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'index'; readonly index: number };

/** 1-indexed, inclusive, `start <= end`. Same contract as the kit CodeView reveal. */
export interface ProvenanceLineRange {
  readonly start: number;
  readonly end: number;
}

/** The closed set of entry kinds. `isProvenanceEntry` narrows against it. */
export const PROVENANCE_ENTRY_KINDS = Object.freeze(['file', 'range', 'created'] as const);

export type ProvenanceEntryKind = (typeof PROVENANCE_ENTRY_KINDS)[number];

/**
 * One attribution inside one generated file.
 *
 * - `file`    — every config path read while producing the file's content,
 *               plus every path attached through `addRange`. Exactly one per
 *               recorded file; `paths` may be empty.
 * - `range`   — the paths read to produce the lines `range` occupies in the
 *               final file. Zero or more per file.
 * - `created` — the paths the generator read to decide that this file exists
 *               at all. Zero or one per file; disjoint from the `file` entry.
 *
 * `paths` is always sorted by code-unit order and free of duplicates.
 */
export type ProvenanceEntry =
  | { readonly kind: 'file'; readonly paths: readonly ConfigPath[] }
  | {
      readonly kind: 'range';
      readonly range: ProvenanceLineRange;
      readonly paths: readonly ConfigPath[];
      /**
       * The attributions of this range that merely DISPLAY their value rather
       * than determine it. A non-empty, sorted, duplicate-free subset of
       * `paths`; absent when nothing is secondary.
       *
       * Absence means every path is primary. There is no representation of
       * "secondary by default": a demotion must name the path it demotes, and
       * `[]` is never recorded, so one state has one spelling. Ask
       * `isSecondaryAttribution` rather than reading this directly — a prefix
       * query is answered per attribution, never per entry.
       */
      readonly secondaryPaths?: readonly ConfigPath[];
    }
  | { readonly kind: 'created'; readonly paths: readonly ConfigPath[] };

/** Entries for one generated file, in canonical order: `file`, then `created`, then `range`s by `start`. */
export interface FileProvenance {
  readonly entries: readonly ProvenanceEntry[];
}

/**
 * Provenance for one generation. Keys are the same relative paths as
 * `GenerationResult.files`. A key present in `files` but absent here means the
 * generator did not record that file — a migration gap, not "depends on nothing".
 */
export interface ProvenanceResult {
  readonly files: Readonly<Record<string, FileProvenance>>;
}

/** A value computed under recording, together with what it read. */
export interface Observed<R> {
  readonly value: R;
  readonly paths: readonly ConfigPath[];
}
