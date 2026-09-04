/**
 * SF-10 — what a second run, a second recording and a merge must reproduce,
 * plus the surface the change is allowed to touch.
 * INV-12, INV-13, INV-14, INV-17 (core half), INV-22, INV-24 (statics),
 * INV-27 (core half), INV-33 (delta).
 * Category: Idempotency & Retry + Auth Boundary + Resource Limits + Re-usability.
 *
 * The standing rule on memo / cache / skip keys is discharged here: the two
 * keys that exist are enumerated with their inputs and each gets a test that
 * varies only that input.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createProvenanceCollector } from '../../src/provenance/provenance-collector';
import { isProvenanceEntry, mergeProvenance } from '../../src/provenance/provenance-result';
import type { FileProvenance, ProvenanceEntry, ProvenanceResult } from '../../src/provenance/types';

const PROVENANCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'provenance'
);

interface Cfg {
  readonly token: { readonly name: string; readonly symbol: string };
}
const CONFIG: Cfg = { token: { name: 'Alpha', symbol: 'ALP' } };
const FILE = 'out/deploy.sh';

/** A whole recorded "generation": several files, marked and unmarked ranges. */
function recordGeneration(): ProvenanceResult {
  const collector = createProvenanceCollector(CONFIG, { enabled: true });
  collector.record('out/deploy.sh', (scope) => {
    const name: string = scope.config.token.name;
    expect(name).toBe('Alpha');
    scope.addRange({ start: 1, end: 2 }, ['token.name'], { secondaryPaths: ['token.name'] });
    scope.addRange({ start: 5, end: 9 }, ['token.name', 'token.symbol']);
  });
  collector.record('out/contract.rs', (scope) => {
    scope.addRange({ start: 3, end: 3 }, ['token.symbol']);
  });
  const result = collector.result();
  if (result === undefined) throw new Error('expected a result');
  return result;
}

const rangesOf = (
  result: ProvenanceResult,
  filePath: string
): readonly Extract<ProvenanceEntry, { kind: 'range' }>[] =>
  (result.files[filePath]?.entries ?? []).filter((entry) => entry.kind === 'range');

describe('INV-12 — marking is deterministic and carries no cross-run state', () => {
  it('two recordings of the same config are toStrictEqual, marks included', () => {
    expect(recordGeneration()).toStrictEqual(recordGeneration());
  });

  it('the two runs’ secondary arrays are equal in content but NOT the same object', () => {
    // A module-level accumulator would show up here first: shared state that
    // survives between collectors makes the second run's marks the first run's.
    const first = rangesOf(recordGeneration(), 'out/deploy.sh')[0];
    const second = rangesOf(recordGeneration(), 'out/deploy.sh')[0];
    expect(first?.secondaryPaths).toEqual(second?.secondaryPaths);
    expect(first?.secondaryPaths).not.toBe(second?.secondaryPaths);
  });

  it('a mark in one collector never reaches another', () => {
    const marked = createProvenanceCollector(CONFIG, { enabled: true });
    marked.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
    });
    marked.result();

    const clean = createProvenanceCollector(CONFIG, { enabled: true });
    clean.record(FILE, (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.name']);
    });
    expect(rangesOf(clean.result() as ProvenanceResult, FILE)[0]).toStrictEqual({
      kind: 'range',
      range: { start: 1, end: 1 },
      paths: ['token.name'],
    });
  });
});

describe('INV-13 — re-recording a file replaces its marks wholesale', () => {
  const rerecord = (first: boolean, second: boolean): ProvenanceResult => {
    const collector = createProvenanceCollector(CONFIG, { enabled: true });
    collector.record('out/a.txt', (scope) => {
      scope.addRange(
        { start: 1, end: 1 },
        ['token.name'],
        ...(first ? [{ secondaryPaths: ['token.name'] }] : [])
      );
    });
    collector.record('out/b.txt', (scope) => {
      scope.addRange({ start: 1, end: 1 }, ['token.symbol']);
    });
    collector.record('out/a.txt', (scope) => {
      scope.addRange(
        { start: 7, end: 8 },
        ['token.name'],
        ...(second ? [{ secondaryPaths: ['token.name'] }] : [])
      );
    });
    const result = collector.result();
    if (result === undefined) throw new Error('expected a result');
    return result;
  };

  it('marked then unmarked → exactly one range, unmarked', () => {
    const ranges = rangesOf(rerecord(true, false), 'out/a.txt');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toStrictEqual({
      kind: 'range',
      range: { start: 7, end: 8 },
      paths: ['token.name'],
    });
  });

  it('unmarked then marked → exactly one range, marked', () => {
    const ranges = rangesOf(rerecord(false, true), 'out/a.txt');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.secondaryPaths).toEqual(['token.name']);
  });

  it('the re-recorded file keeps its original position in key order', () => {
    expect(Object.keys(rerecord(true, false).files)).toEqual(['out/a.txt', 'out/b.txt']);
  });
});

describe('INV-14 — significance is not an input of any skip or memo key', () => {
  describe('key 1: `enabled` — sole input `options?.enabled`', () => {
    const marked = (scope: { addRange: (...args: never[]) => void }): void => {
      (scope.addRange as unknown as (r: unknown, p: unknown, o: unknown) => void)(
        { start: 1, end: 1 },
        ['token.name'],
        { secondaryPaths: ['token.name'] }
      );
    };

    it('enabled: true → the mark is recorded', () => {
      const collector = createProvenanceCollector(CONFIG, { enabled: true });
      collector.record(FILE, (scope) => marked(scope as never));
      expect(rangesOf(collector.result() as ProvenanceResult, FILE)[0]?.secondaryPaths).toEqual([
        'token.name',
      ]);
    });

    it('enabled: false → no result at all', () => {
      const collector = createProvenanceCollector(CONFIG, { enabled: false });
      collector.record(FILE, (scope) => marked(scope as never));
      expect(collector.result()).toBeUndefined();
    });

    it('options absent → no result at all', () => {
      const collector = createProvenanceCollector(CONFIG);
      collector.record(FILE, (scope) => marked(scope as never));
      expect(collector.result()).toBeUndefined();
    });

    it('the subset check fires in all three cells — it sits outside the key', () => {
      for (const options of [{ enabled: true }, { enabled: false }, undefined]) {
        const collector = createProvenanceCollector(CONFIG, options);
        expect(
          () =>
            collector.record(FILE, (scope) => {
              scope.addRange({ start: 1, end: 1 }, ['token.name'], {
                secondaryPaths: ['token.absent'],
              });
            }),
          JSON.stringify(options)
        ).toThrow(/secondary/i);
      }
    });
  });

  describe('key 2: `memoisedResult` — inputs are every entry written before the first call', () => {
    it('`result()` twice returns the same object reference', () => {
      const collector = createProvenanceCollector(CONFIG, { enabled: true });
      collector.record(FILE, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
      });
      const first = collector.result();
      const second = collector.result();
      expect(first).toBe(second);
    });

    it('a mark written before the first call is present in both reads', () => {
      const collector = createProvenanceCollector(CONFIG, { enabled: true });
      collector.record(FILE, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
      });
      expect(rangesOf(collector.result() as ProvenanceResult, FILE)[0]?.secondaryPaths).toEqual([
        'token.name',
      ]);
      expect(rangesOf(collector.result() as ProvenanceResult, FILE)[0]?.secondaryPaths).toEqual([
        'token.name',
      ]);
    });

    it('the collector is closed after the first call, so no mark can be added between them', () => {
      const collector = createProvenanceCollector(CONFIG, { enabled: true });
      collector.record(FILE, (scope) => {
        scope.addRange({ start: 1, end: 1 }, ['token.name']);
      });
      collector.result();
      expect(() =>
        collector.record('out/late.txt', (scope) => {
          scope.addRange({ start: 1, end: 1 }, ['token.name'], { secondaryPaths: ['token.name'] });
        })
      ).toThrow(/closed/i);
    });
  });

  it('no new memo container was introduced anywhere in `src/provenance/`', () => {
    // The two keys above are the whole inventory. A `Map<rangeKey, boolean>`
    // keyed without `filePath` would let a display range in one file demote a
    // determining range in another — a cache-key bug producing exactly the
    // silent demotion this sub-feature exists to prevent.
    const sources = readdirSync(PROVENANCE_DIR)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => ({
        name,
        code: readFileSync(join(PROVENANCE_DIR, name), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, ''),
      }));

    // Pinned as an INVENTORY, not a prohibition: four of these predate SF-10
    // and are not memos of significance. The assertion fails when a new one
    // appears, which is the moment someone should have to justify it.
    //
    // `config-recorder.ts: new Map(` is `unwrapDeep`'s per-call cycle guard,
    // keyed by container identity and discarded when the call returns; it
    // holds no significance and outlives no scope.
    const containers = sources.flatMap(({ name, code }) =>
      [...code.matchAll(/new Weak(?:Map|Set)\b|new Map\(|\?\?=/g)].map(
        (match) => `${name}: ${match[0]}`
      )
    );
    expect(containers.sort()).toEqual([
      'builder-registry.ts: new WeakSet',
      'config-recorder.ts: new Map(',
      'config-recorder.ts: new WeakMap',
      'config-recorder.ts: new WeakMap',
      'provenance-collector.ts: ??=',
    ]);
    // None of them is keyed on, or reads, significance.
    for (const { name, code } of sources) {
      const memoLines = code.split('\n').filter((line) => /new Weak|\?\?=/.test(line));
      for (const line of memoLines) {
        expect(line, `${name}: ${line.trim()}`).not.toMatch(/secondar/i);
      }
    }
  });
});

describe('INV-17 — `isProvenanceEntry` is blind to `secondaryPaths` (core half)', () => {
  const base: ProvenanceEntry = {
    kind: 'range',
    range: { start: 1, end: 2 },
    paths: ['token.name'],
  };

  const VALUES: ReadonlyArray<readonly [string, unknown]> = [
    ['undefined', undefined],
    ['empty array', []],
    ['valid subset', ['token.name']],
    ['a string', 'x'],
    ['null', null],
    ['a number', 42],
    ['an object', {}],
    ['an array of numbers', [1, 2]],
    ['a disjoint set', ['not.attributed']],
  ];

  it.each(VALUES)('accepts a valid entry carrying secondaryPaths = %s', (_label, value) => {
    expect(isProvenanceEntry({ ...base, secondaryPaths: value })).toBe(true);
    expect(isProvenanceEntry(base)).toBe(true);
  });

  it('accepts an entry whose `secondaryPaths` getter throws', () => {
    // The guard must not even READ the field: folding an optional presentational
    // hint into the required-member guard would let one bad byte of metadata
    // drop a truthful site.
    const hostile: Record<string, unknown> = { ...base };
    Object.defineProperty(hostile, 'secondaryPaths', {
      enumerable: true,
      get() {
        throw new Error('hostile');
      },
    });
    expect(isProvenanceEntry(hostile)).toBe(true);
  });

  it('rejects for the reasons it always did, mark or no mark', () => {
    expect(isProvenanceEntry({ kind: 'bogus', paths: [], secondaryPaths: ['a'] })).toBe(false);
    expect(isProvenanceEntry({ kind: 'range', paths: [], secondaryPaths: ['a'] })).toBe(false);
  });
});

describe('INV-22 — `mergeProvenance` is wholesale: every merged entry is an input entry', () => {
  const markedEntry: ProvenanceEntry = {
    kind: 'range',
    range: { start: 1, end: 1 },
    paths: ['token.name'],
    secondaryPaths: ['token.name'],
  };
  const unmarkedEntry: ProvenanceEntry = {
    kind: 'range',
    range: { start: 1, end: 1 },
    paths: ['token.name'],
  };
  const markedFile: FileProvenance = { entries: [markedEntry] };
  const unmarkedFile: FileProvenance = { entries: [unmarkedEntry] };

  it('every merged entry and every FileProvenance is reference-identical to an input', () => {
    const a: ProvenanceResult = { files: { 'a.sh': markedFile, shared: unmarkedFile } };
    const b: ProvenanceResult = { files: { 'b.sh': unmarkedFile, shared: markedFile } };
    const merged = mergeProvenance(a, b);

    const inputFiles = new Set([markedFile, unmarkedFile]);
    const inputEntries = new Set<ProvenanceEntry>([markedEntry, unmarkedEntry]);
    for (const [key, file] of Object.entries(merged.files)) {
      expect(inputFiles.has(file), key).toBe(true);
      for (const entry of file.entries) expect(inputEntries.has(entry), key).toBe(true);
    }
  });

  it('a later unmarked file wins over an earlier marked one, BY IDENTITY not by combination', () => {
    // The corollary spelled out: nothing can be downgraded when nothing is
    // combined. A future entry-level merge would have to take the INTERSECTION
    // of the secondary sets — union is the downgrade.
    const merged = mergeProvenance(
      { files: { 'a.sh': markedFile } },
      { files: { 'a.sh': unmarkedFile } }
    );
    expect(merged.files['a.sh']).toBe(unmarkedFile);
  });

  it('key order is the first result’s keys then each later result’s new keys', () => {
    const merged = mergeProvenance(
      { files: { 'a.sh': markedFile, 'b.sh': unmarkedFile } },
      { files: { 'b.sh': markedFile, 'c.sh': unmarkedFile } }
    );
    expect(Object.keys(merged.files)).toEqual(['a.sh', 'b.sh', 'c.sh']);
  });

  it('empty, single and disjoint inputs all behave', () => {
    expect(mergeProvenance()).toEqual({ files: {} });
    expect(mergeProvenance({ files: {} })).toEqual({ files: {} });
    const single: ProvenanceResult = { files: { 'a.sh': markedFile } };
    expect(mergeProvenance(single).files['a.sh']).toBe(markedFile);
  });

  it('inputs are not mutated', () => {
    const a: ProvenanceResult = { files: { 'a.sh': markedFile } };
    const snapshot = JSON.stringify(a);
    mergeProvenance(a, { files: { 'a.sh': unmarkedFile } });
    expect(JSON.stringify(a)).toBe(snapshot);
  });

  it('`provenance-result.ts` contains no entry-level combination', () => {
    const code = readFileSync(join(PROVENANCE_DIR, 'provenance-result.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const mergeBody = code.slice(code.indexOf('export function mergeProvenance'));
    const bodyEnd = mergeBody.indexOf('\n}');
    expect(mergeBody.slice(0, bodyEnd)).not.toMatch(/secondaryPaths/);
  });
});

describe('INV-27 / INV-33 — the core half of "the generator never classifies"', () => {
  const sources = readdirSync(PROVENANCE_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => ({
      name,
      code: readFileSync(join(PROVENANCE_DIR, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, ''),
    }));

  it('no source file classifies emitted text to decide significance', () => {
    for (const { name, code } of sources) {
      expect(code, name).not.toMatch(/isDisplay/);
      expect(code, name).not.toMatch(/\becho\b/);
      expect(code, name).not.toMatch(/RegExp\(/);
    }
  });

  it('`src/provenance/` file count matches the published layout (omit-config-path is additive)', () => {
    expect(sources).toHaveLength(12);
  });

  it("no exported value spells 'primary' or 'secondary' as a significance LEVEL", () => {
    // D1: there is no vocabulary constant, so there is nothing for a third level
    // to grow on and nothing a string could be threaded through.
    for (const { name, code } of sources) {
      expect(code, name).not.toMatch(/'primary'/);
      expect(code, name).not.toMatch(/'secondary'/);
      expect(code, name).not.toMatch(/"secondary"/);
    }
  });
});
