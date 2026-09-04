import { createFile } from '../file-tree';
import type { FileTree } from '../types';
import { parseConfigPath } from './config-path';
import { openConfigRecorder } from './config-recorder';
import type { ConfigRecorderHandle } from './config-recorder';
import { ProvenanceAttributionError, ProvenanceScopeError } from './errors';
import type {
  ConfigPath,
  FileProvenance,
  Observed,
  ProvenanceEntry,
  ProvenanceLineRange,
  ProvenanceResult,
} from './types';

export interface AddRangeOptions {
  /**
   * Which of `paths` merely display their value rather than determine it. Must
   * be a subset of `paths`: a path the range does not attribute is a template
   * bug and throws `ProvenanceAttributionError('secondary-not-attributed')`.
   * `[]` and `undefined` are equivalent — both record nothing.
   */
  readonly secondaryPaths?: readonly ConfigPath[];
}

export interface ProvenanceScope<T extends object> {
  /** The relative path of the file this scope records — the `record`/`createFile` argument. */
  readonly filePath: string;
  /** Recording view of the config for this file (the raw config when the collector is disabled). */
  readonly config: T;
  /** Paths read in this scope since the previous `drain()`. `[]` when disabled. */
  drain(): ConfigPath[];
  /**
   * Attach a `range` entry to this file. `paths` is normalised (sorted, deduped)
   * and folded into the file's `file` entry. The range's shape and every path
   * literal (including `options.secondaryPaths`) are validated even when
   * disabled (`RangeError`); the range's position against the final text is the
   * caller's responsibility.
   *
   * `options.secondaryPaths` is normalised the same way and recorded as the
   * entry's `secondaryPaths`, omitted entirely when empty. It is validated as a
   * subset of `paths` even when disabled — the same discipline as the range
   * shape, so a template bug cannot hide behind `recordProvenance: false`.
   *
   * This is the ONLY writer of significance: an entry carries a mark iff the
   * call that created it named one.
   */
  addRange(
    range: ProvenanceLineRange,
    paths: readonly ConfigPath[],
    options?: AddRangeOptions
  ): void;
}

export interface RecordOptions {
  /** Paths the generator read to decide this file exists; becomes the file's `created` entry. Usually `observe(...).paths`. */
  readonly createdBy?: readonly ConfigPath[];
}

export interface ProvenanceCollector<T extends object> {
  /** `true` iff `options.enabled` was `true`. Generators may branch on it for expensive attribution work only. */
  readonly enabled: boolean;

  /**
   * Produce one file under its own recording scope. Everything `produce` reads
   * through `scope.config` becomes the file's `file` entry; ranges added through
   * `scope.addRange` are attached; `createdBy` becomes its `created` entry.
   *
   * Recording the same `filePath` again REPLACES its previous entries and keeps
   * its original position. Scopes do not nest: calling `record` inside `produce`
   * throws `ProvenanceScopeError('nested')`. `produce` is synchronous — the scope
   * closes when it returns, so a `Promise`-returning `produce` has its views
   * closed before any awaited read, and that read throws `ProvenanceScopeError('closed')`.
   * Views returned from `produce` — at the top level or nested inside plain
   * objects and arrays — are unwrapped to their raw targets.
   * When disabled, runs `produce` with the raw config and records nothing.
   */
  record<R>(
    filePath: string,
    produce: (scope: ProvenanceScope<T>) => R,
    options?: RecordOptions
  ): R;

  /**
   * `record` specialised to a single text/binary file: returns
   * `createFile(filePath, content)` so the recorded path and the tree key are
   * one literal.
   */
  createFile(
    filePath: string,
    produce: (scope: ProvenanceScope<T>) => string | Uint8Array,
    options?: RecordOptions
  ): FileTree;

  /**
   * Run a computation under recording WITHOUT attaching it to a file, and get
   * back both the value and the paths it read. Allowed inside a `record` scope;
   * its reads attribute to no file. Views returned from `compute` — at the top
   * level or nested inside plain objects and arrays (`filter`, `map`, object
   * literals) — are unwrapped to their raw targets, so the same template code
   * behaves identically with recording on and off. A view stashed in a
   * non-plain container (a `Map`, a class instance) is closed and throws on a
   * later read — see `provenance-collector.test.ts` ("non-plain container").
   * When disabled, `paths` is `[]`.
   */
  observe<R>(compute: (config: T) => R): Observed<R>;

  /**
   * The assembled result, or `undefined` when disabled. Idempotent, and closes
   * the collector: any later `record`, `createFile` or `observe` throws
   * `ProvenanceScopeError('closed')`. Entries per file are in canonical order;
   * `paths` sorted and deduped; files keyed in first-recorded order.
   */
  result(): ProvenanceResult | undefined;
}

export interface ProvenanceCollectorOptions {
  /** Mirrors `GenerateOptions.recordProvenance`. Default `false`. */
  readonly enabled?: boolean;
}

type RangeEntry = Extract<ProvenanceEntry, { kind: 'range' }>;

/** Sorted, deduplicated, fresh. */
function normalisePaths(paths: readonly ConfigPath[]): ConfigPath[] {
  return [...new Set(paths)].sort();
}

/** Shape only — position against the produced text is the caller's. */
function assertValidRange(range: ProvenanceLineRange): void {
  const { start, end } = range;
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) {
    throw new RangeError(
      `Invalid provenance line range: start and end must be integers with 1 <= start <= end (got start=${start}, end=${end})`
    );
  }
}

/**
 * Every path must be a string the config-path dialect can parse. Checked at
 * write time so a malformed template literal cannot poison later queries that
 * call `parseConfigPath` / `filterProvenanceByPath` on the assembled result.
 * Runs regardless of `enabled`, matching `assertValidRange`.
 */
function assertValidPaths(paths: readonly ConfigPath[]): void {
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    if (typeof path !== 'string') {
      throw new RangeError(
        `Invalid provenance config path at index ${index}: expected string, got ${typeof path}`
      );
    }
    parseConfigPath(path);
  }
}

/**
 * The subset rule, checked before any state is written and regardless of
 * `enabled`. Returns the normalised secondary set so the caller allocates it
 * once; throws naming only the offending paths, never a value.
 */
function assertSecondaryAttributed(
  filePath: string,
  paths: readonly ConfigPath[],
  secondaryPaths: readonly ConfigPath[]
): ConfigPath[] {
  const attributed = new Set(paths);
  const normalised = normalisePaths(secondaryPaths);
  const offending = normalised.filter((path) => !attributed.has(path));
  if (offending.length > 0) {
    throw new ProvenanceAttributionError('secondary-not-attributed', filePath, offending);
  }
  return normalised;
}

function compareRanges(a: RangeEntry, b: RangeEntry): number {
  return a.range.start - b.range.start || a.range.end - b.range.end;
}

/**
 * One collector per `generate()` call. Pass `{ enabled: options?.recordProvenance === true }`.
 * No state is shared between collectors.
 */
export function createProvenanceCollector<T extends object>(
  config: T,
  options?: ProvenanceCollectorOptions
): ProvenanceCollector<T> {
  const enabled = options?.enabled === true; // INV-20: the only input of the skip key
  const files = new Map<string, FileProvenance>();
  let activeScope: string | null = null;
  let closed = false;
  let memoisedResult: ProvenanceResult | undefined;

  const assertCollectorOpen = (filePath?: string): void => {
    if (closed) throw new ProvenanceScopeError('closed', filePath); // INV-14
  };

  function record<R>(
    filePath: string,
    produce: (scope: ProvenanceScope<T>) => R,
    recordOptions?: RecordOptions
  ): R {
    assertCollectorOpen(filePath);
    if (activeScope !== null) throw new ProvenanceScopeError('nested', filePath); // INV-16

    const handle: ConfigRecorderHandle<T> | null = enabled ? openConfigRecorder(config) : null;
    const ranges: RangeEntry[] = [];
    const rangePaths = new Set<ConfigPath>();
    let scopeClosed = false;
    const assertScopeOpen = (): void => {
      if (scopeClosed) throw new ProvenanceScopeError('closed', filePath); // INV-17
    };

    const scope: ProvenanceScope<T> = {
      filePath,
      config: handle === null ? config : handle.recorder.view,
      drain() {
        assertScopeOpen();
        return handle === null ? [] : handle.recorder.drain();
      },
      addRange(range, paths, options) {
        assertScopeOpen();
        assertValidRange(range); // INV-10: validated regardless of `enabled`
        assertValidPaths(paths);
        // INV-9: the subset rule is checked after the scope and range guards,
        // before any state is written, and regardless of `enabled` — so a
        // template bug cannot hide on a caller's recording-off path.
        // INV-1/INV-24: an unmarked range normalises and allocates nothing here.
        const declared = options?.secondaryPaths;
        if (declared !== undefined) assertValidPaths(declared);
        const secondaryPaths =
          declared === undefined || declared.length === 0
            ? undefined
            : assertSecondaryAttributed(filePath, paths, declared);
        if (handle === null) return;
        const normalised = normalisePaths(paths);
        normalised.forEach((path) => rangePaths.add(path));
        // INV-2: significance rides the range entry only; `rangePaths` — and so
        // the file entry — never learns of it.
        // INV-4: `paths` and `secondaryPaths` are separately normalised, so the
        // two members are never the same array even when equal in content.
        ranges.push(
          secondaryPaths === undefined
            ? {
                kind: 'range',
                range: { start: range.start, end: range.end },
                paths: normalised,
              }
            : {
                kind: 'range',
                range: { start: range.start, end: range.end },
                paths: normalised,
                secondaryPaths,
              }
        );
      },
    };

    activeScope = filePath;
    let produced: R;
    try {
      produced = produce(scope);
    } finally {
      // INV-16, INV-17, INV-19: the scope closes however `produce` ends; a throw
      // propagates unchanged (INV-10) and installs nothing.
      activeScope = null;
      scopeClosed = true;
      handle?.close(filePath);
    }
    if (handle === null) return produced;

    // INV-7: file paths are every read plus every ranged path; created stays disjoint.
    const filePaths = normalisePaths([...handle.recorder.all(), ...rangePaths]);
    const entries: ProvenanceEntry[] = [{ kind: 'file', paths: filePaths }];
    if (recordOptions?.createdBy !== undefined) {
      entries.push({ kind: 'created', paths: normalisePaths(recordOptions.createdBy) }); // INV-28
    }
    entries.push(...[...ranges].sort(compareRanges));
    files.set(filePath, { entries }); // INV-18: replaces wholesale, keeps first-recorded position
    return handle.unwrap(produced);
  }

  return {
    enabled,
    record,
    createFile(filePath, produce, recordOptions) {
      return createFile(filePath, record(filePath, produce, recordOptions));
    },
    observe<R>(compute: (config: T) => R): Observed<R> {
      assertCollectorOpen();
      if (!enabled) return { value: compute(config), paths: [] }; // INV-20
      const handle = openConfigRecorder(config);
      let value: R;
      try {
        value = compute(handle.recorder.view);
      } finally {
        handle.close(); // INV-17, INV-19
      }
      return { value: handle.unwrap(value), paths: handle.recorder.all() }; // INV-15: attributed to no file
    },
    result() {
      closed = true; // INV-14
      if (!enabled) return undefined;
      memoisedResult ??= { files: Object.fromEntries(files) };
      return memoisedResult;
    },
  };
}
