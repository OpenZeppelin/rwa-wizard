/**
 * Shared doubles for the SF-2 builder suites: a spy `ProvenanceScope` whose
 * drain window the test controls, plus a real-collector helper.
 *
 * The config type is deliberately NOT `RWAConfig` (INV-28): the builders are a
 * chain-agnostic brick.
 */
import type { AddRangeOptions, ProvenanceScope } from '../../src/provenance/provenance-collector';
import type { ConfigPath, ProvenanceLineRange } from '../../src/provenance/types';

export interface FixtureConfig {
  readonly settings: { readonly name: string; readonly symbol: string; readonly decimals: number };
  readonly members: readonly string[];
}

export const fixtureConfig: FixtureConfig = {
  settings: { name: 'Alpha', symbol: 'ALP', decimals: 7 },
  members: ['m0', 'm1'],
};

export type ScopeCall =
  | { readonly kind: 'drain'; readonly returned: readonly ConfigPath[] }
  | {
      readonly kind: 'addRange';
      readonly range: ProvenanceLineRange;
      readonly paths: readonly ConfigPath[];
      /**
       * The third argument EXACTLY as the caller passed it — `undefined` when no
       * options object was constructed at all (SF-10 INV-3, INV-24). Recorded
       * by reference so a test can assert `secondaryPaths` is the very array
       * the emission passed as `paths`.
       */
      readonly options?: AddRangeOptions;
    };

export interface SpyScope extends ProvenanceScope<FixtureConfig> {
  /** Queue paths that the next `drain()` returns. */
  read(...paths: ConfigPath[]): void;
  readonly calls: ScopeCall[];
  readonly ranges: Array<{
    range: ProvenanceLineRange;
    paths: readonly ConfigPath[];
    options?: AddRangeOptions;
  }>;
}

export interface SpyScopeOptions {
  readonly filePath?: string;
  /** Disabled scope: `drain()` is always `[]`, `addRange` validates and records nothing. */
  readonly disabled?: boolean;
  readonly config?: FixtureConfig;
}

/** Shape validation identical to SF-1's `assertValidRange` (INV-10 backstop). */
function assertValidRange(range: ProvenanceLineRange): void {
  const { start, end } = range;
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) {
    throw new RangeError(`Invalid provenance line range (got start=${start}, end=${end})`);
  }
}

export function createSpyScope(options: SpyScopeOptions = {}): SpyScope {
  const window = new Set<ConfigPath>();
  const calls: ScopeCall[] = [];
  const ranges: SpyScope['ranges'] = [];
  const disabled = options.disabled === true;
  return {
    filePath: options.filePath ?? 'out/fixture.txt',
    config: options.config ?? fixtureConfig,
    calls,
    ranges,
    read(...paths) {
      if (!disabled) paths.forEach((p) => window.add(p));
    },
    drain() {
      const returned = [...window].sort();
      window.clear();
      calls.push({ kind: 'drain', returned });
      return returned;
    },
    addRange(range, paths, addOptions) {
      assertValidRange(range);
      const copy = [...new Set(paths)].sort();
      calls.push({ kind: 'addRange', range: { ...range }, paths: copy, options: addOptions });
      if (!disabled) ranges.push({ range: { ...range }, paths: copy, options: addOptions });
    },
  };
}

/** The lines of `text` a range covers, 1-indexed inclusive — the SC-003 containment oracle. */
export function linesOf(text: string, range: ProvenanceLineRange): string[] {
  return text.split('\n').slice(range.start - 1, range.end);
}
