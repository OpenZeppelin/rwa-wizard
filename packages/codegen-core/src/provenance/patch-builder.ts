/**
 * Line attribution over the exact source-patch primitives.
 *
 * Every byte comes from `replaceExact` / `insertBeforeExact` / `insertAfterExact`,
 * so `text()` is byte-identical to applying the same calls directly and the
 * replacement-pattern semantics of those functions are untouched. Each edit is
 * tracked as a byte region of the *current* text and shifted by every later
 * edit; regions become line ranges once, at `text()`, against the final text.
 */
import { insertAfterExact, insertBeforeExact, replaceExact } from '../source-patch';
import { bindScope } from './builder-registry';
import { ProvenanceAttributionError } from './errors';
import { hasAttributableContent, regionToLineRange } from './line-ranges';
import type { ProvenanceScope } from './provenance-collector';
import type { ConfigPath, Observed } from './types';

/** The three patch primitives, one-for-one, plus attribution. Same union rule as `LineSink`. */
export interface PatchSink {
  /** `replaceExact(current, search, replacement)`. The replaced region is attributed even when the bytes are unchanged. */
  replaceExact(search: string, replacement: string, extraPaths?: readonly ConfigPath[]): void;
  /** `insertBeforeExact(current, marker, insertion)`. Only the inserted bytes are attributed. */
  insertBeforeExact(marker: string, insertion: string, extraPaths?: readonly ConfigPath[]): void;
  /** `insertAfterExact(current, marker, insertion)`. Only the inserted bytes are attributed. */
  insertAfterExact(marker: string, insertion: string, extraPaths?: readonly ConfigPath[]): void;
}

export interface PatchBuilder<T extends object> extends PatchSink {
  /** The scope's recording view of the config. */
  readonly config: T;
  /** Compute a value used across edits and get its paths back without attributing them here. */
  observe<R>(compute: (config: T) => R): Observed<R>;
  /** The text after every edit so far. A plain string: reading it records nothing. */
  readonly current: string;
  /**
   * The final text — byte-identical to applying the same edits with the core
   * functions directly. Resolves every region to a line range against this
   * text and records the ones with paths. Idempotent; seals the builder.
   */
  text(): string;
}

/** Which primitive produced a piece — the marker-exclusion rule differs per kind. */
type EditKind = 'replace' | 'before' | 'after';

interface MutableRegion {
  readonly start: number;
  readonly end: number;
  readonly paths: readonly ConfigPath[];
}

/**
 * Bind a patch builder to one scope over an upstream `source`. Same
 * construction rules as `createLineBuilder`: first toucher of the scope, one
 * builder per scope.
 */
export function createPatchBuilder<T extends object>(
  scope: ProvenanceScope<T>,
  source: string
): PatchBuilder<T> {
  const cursor = bindScope(scope);

  let regions: MutableRegion[] = [];
  let current = source;
  let sealed = false;
  let output: string | undefined;

  const assertUnsealed = (): void => {
    if (sealed) throw new ProvenanceAttributionError('emit-after-text', scope.filePath); // INV-12
  };

  const applyEdit = (
    kind: EditKind,
    search: string,
    payload: string,
    extraPaths?: readonly ConfigPath[]
  ): void => {
    assertUnsealed();
    // The occurrence `String.prototype.replace` rewrites is the first one.
    const index = current.indexOf(search);
    // INV-2, INV-16: bytes come from the core functions, and a missing snippet
    // throws before any state of this builder has moved.
    const next =
      kind === 'replace'
        ? replaceExact(current, search, payload)
        : kind === 'before'
          ? insertBeforeExact(current, search, payload)
          : insertAfterExact(current, search, payload);

    // The piece that replaced `search`, measured from the length change so a
    // replacement pattern cannot desynchronise text and positions.
    const pieceLength = next.length - (current.length - search.length);
    let start = index;
    let end = index + pieceLength;
    if (pieceLength >= search.length) {
      // INV-7: exclude the marker only when the piece carries it verbatim.
      if (kind === 'after' && next.startsWith(search, index)) start = index + search.length;
      if (kind === 'before' && next.startsWith(search, end - search.length)) end -= search.length;
    }

    const paths = new Set<ConfigPath>(cursor.take(extraPaths)); // INV-5
    const delta = pieceLength - search.length;
    const searchEnd = index + search.length;
    const shifted: MutableRegion[] = [];
    for (const region of regions) {
      if (region.end <= index) {
        shifted.push(region); // wholly before the edit: untouched
        continue;
      }
      if (region.start >= searchEnd) {
        shifted.push({ start: region.start + delta, end: region.end + delta, paths: region.paths });
        continue;
      }
      // Insert edits that anchor on a prior insert's payload must keep that
      // earlier region intact instead of clipping it and merging paths (B-7).
      // insertAfter places the new bytes after the marker → region stays put;
      // insertBefore places them at `index` → the marker (and this region) moves
      // forward by `delta`.
      if (kind !== 'replace' && region.start <= index && region.end === searchEnd) {
        shifted.push(
          kind === 'before'
            ? { start: region.start + delta, end: region.end + delta, paths: region.paths }
            : region
        );
        continue;
      }
      // Overlaps the replaced span: the surviving parts keep their paths, and
      // the overlapping part's dependency joins the new region. A part left
      // holding only terminators is dropped — it could claim only a line it did
      // not produce, and its paths ride the new region regardless.
      region.paths.forEach((path) => paths.add(path));
      if (region.start < index && hasAttributableContent(next.slice(region.start, index))) {
        shifted.push({ start: region.start, end: index, paths: region.paths });
      }
      if (region.end > searchEnd) {
        const tailStart = searchEnd + delta;
        const tailEnd = region.end + delta;
        if (hasAttributableContent(next.slice(tailStart, tailEnd))) {
          shifted.push({ start: tailStart, end: tailEnd, paths: region.paths });
        }
      }
    }
    shifted.push({ start, end, paths: [...paths].sort() });
    regions = shifted;
    current = next;
  };

  return {
    get config() {
      return scope.config;
    },
    get current() {
      return current;
    },
    replaceExact(search, replacement, extraPaths) {
      applyEdit('replace', search, replacement, extraPaths);
    },
    insertBeforeExact(marker, insertion, extraPaths) {
      applyEdit('before', marker, insertion, extraPaths);
    },
    insertAfterExact(marker, insertion, extraPaths) {
      applyEdit('after', marker, insertion, extraPaths);
    },
    observe(compute) {
      assertUnsealed();
      return cursor.observe(compute);
    },
    text() {
      if (output === undefined) {
        sealed = true;
        scope.drain(); // trailing window: it shaped no bytes of this file
        // INV-23: resolved once, against the final text, in insertion order.
        for (const region of regions) {
          if (region.paths.length === 0) continue; // INV-5
          scope.addRange(regionToLineRange(current, region), region.paths);
        }
        output = current;
      }
      return output;
    },
  };
}
