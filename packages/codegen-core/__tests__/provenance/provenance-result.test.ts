/**
 * Result helpers: presence test, structural guard, merge, filter.
 * INV-6, INV-9, INV-18, INV-22.
 * Category: Request/Response + Side-Effect Ordering + Resource Limits.
 */
import { describe, expect, it } from 'vitest';

import {
  filterProvenanceByPath,
  hasProvenance,
  isProvenanceEntry,
  mergeProvenance,
} from '../../src/provenance/provenance-result';
import { PROVENANCE_ENTRY_KINDS } from '../../src/provenance/types';
import type { ProvenanceEntry, ProvenanceResult } from '../../src/provenance/types';
import type { GenerationResult } from '../../src/types';

const metadata = {
  generatorName: 'g',
  generatorVersion: '0',
  generatedAt: 'now',
  fileCount: 0,
  configHash: 'h',
};

/**
 * A result as it would arrive from an untrusted generator build in `node_modules`:
 * crosses the module boundary as JSON, so the static type says nothing about
 * what `provenance` actually holds. This is the one place the suite casts, and
 * it casts from the `any` `JSON.parse` returns — the same thing the loader does.
 */
function fromWire(json: string): GenerationResult {
  return JSON.parse(json) as GenerationResult;
}

describe('INV-6 — PROVENANCE_ENTRY_KINDS is closed and isProvenanceEntry is its structural guard', () => {
  it("PROVENANCE_ENTRY_KINDS is exactly ['file','range','created'], frozen", () => {
    expect([...PROVENANCE_ENTRY_KINDS]).toEqual(['file', 'range', 'created']);
    expect(Object.isFrozen(PROVENANCE_ENTRY_KINDS)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['file entry', { kind: 'file', paths: ['a'] }],
    ['file entry with empty paths', { kind: 'file', paths: [] }],
    ['created entry', { kind: 'created', paths: ['a', 'b'] }],
    ['range entry', { kind: 'range', paths: ['a'], range: { start: 1, end: 1 } }],
    ['range entry spanning lines', { kind: 'range', paths: [], range: { start: 3, end: 10 } }],
    ['entry with extra unknown members', { kind: 'file', paths: ['a'], extra: 1 }],
  ])('accepts a valid %s', (_label, value) => {
    expect(isProvenanceEntry(value)).toBe(true);
  });

  it.each<[string, unknown]>([
    ["kind 'FILE'", { kind: 'FILE', paths: [] }],
    ["kind 'line'", { kind: 'line', paths: [] }],
    ["kind 'block' (a newer generator)", { kind: 'block', paths: [] }],
    ['missing kind', { paths: [] }],
    ['non-string kind', { kind: 1, paths: [] }],
    ["paths 'x'", { kind: 'file', paths: 'x' }],
    ['paths [1]', { kind: 'file', paths: [1] }],
    ['paths missing', { kind: 'file' }],
    ['paths null', { kind: 'file', paths: null }],
    ['range with start 0', { kind: 'range', paths: [], range: { start: 0, end: 1 } }],
    ['range with end < start', { kind: 'range', paths: [], range: { start: 2, end: 1 } }],
    ['range with fractional start', { kind: 'range', paths: [], range: { start: 1.5, end: 2 } }],
    ['range missing', { kind: 'range', paths: [] }],
    ['range null', { kind: 'range', paths: [], range: null }],
    ['range with string numbers', { kind: 'range', paths: [], range: { start: '1', end: '2' } }],
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'file'],
    ['array', []],
    ['array shaped like an entry', Object.assign([], { kind: 'file', paths: [] })],
    ['function', () => undefined],
    ['null-prototype object', Object.create(null)],
  ])('rejects %s without throwing', (_label, value) => {
    expect(() => isProvenanceEntry(value)).not.toThrow();
    expect(isProvenanceEntry(value)).toBe(false);
  });

  it('accepts a valid entry with a null prototype (structure, not prototype)', () => {
    const entry = Object.assign(Object.create(null) as object, { kind: 'file', paths: ['a'] });
    expect(isProvenanceEntry(entry)).toBe(true);
  });

  // Was pinned as `it.fails` at Tests stage (the draft propagated a throwing `kind`
  // getter); Code added the try/catch and this now asserts the fix.
  it('does not throw on an object whose kind getter throws (returns false) — INV-6', () => {
    const hostile = {
      get kind(): string {
        throw new Error('hostile getter');
      },
      paths: [],
    };
    expect(() => isProvenanceEntry(hostile)).not.toThrow();
    expect(isProvenanceEntry(hostile)).toBe(false);
  });

  it('reads kind once — a getter that changes value between reads cannot smuggle a bad kind through', () => {
    let reads = 0;
    const flipper = {
      get kind(): string {
        reads += 1;
        return reads === 1 ? 'file' : 'bogus';
      },
      paths: [],
    };
    expect(isProvenanceEntry(flipper)).toBe(true);
    expect(reads).toBe(1);
  });

  it('narrows the type (exhaustive switch compiles on the guarded value)', () => {
    const value: unknown = { kind: 'range', paths: ['a'], range: { start: 1, end: 2 } };
    if (!isProvenanceEntry(value)) throw new Error('expected a valid entry');
    const label = ((entry: ProvenanceEntry): string => {
      switch (entry.kind) {
        case 'file':
          return 'f';
        case 'created':
          return 'c';
        case 'range':
          return `r${entry.range.start}`;
      }
    })(value);
    expect(label).toBe('r1');
  });
});

describe('INV-6 / INV-9 — hasProvenance is a never-throwing presence test', () => {
  it('false when provenance is absent', () => {
    expect(hasProvenance({ files: {}, metadata })).toBe(false);
  });

  it('false when provenance is explicitly undefined', () => {
    expect(hasProvenance({ files: {}, metadata, provenance: undefined })).toBe(false);
  });

  it('true when provenance is { files: {} }', () => {
    const result: GenerationResult = { files: {}, metadata, provenance: { files: {} } };
    expect(hasProvenance(result)).toBe(true);
    if (hasProvenance(result)) expect(result.provenance.files).toEqual({});
  });

  it.each<[string, string]>([
    ['null', '{"files":{},"metadata":{},"provenance":null}'],
    ['a string', '{"files":{},"metadata":{},"provenance":"yes"}'],
    ['a number', '{"files":{},"metadata":{},"provenance":1}'],
    ['an array', '{"files":{},"metadata":{},"provenance":[]}'],
    ['an object without files', '{"files":{},"metadata":{},"provenance":{"entries":[]}}'],
    ['files: null', '{"files":{},"metadata":{},"provenance":{"files":null}}'],
    ['files: a string', '{"files":{},"metadata":{},"provenance":{"files":"x"}}'],
    ['files: an array', '{"files":{},"metadata":{},"provenance":{"files":[]}}'],
  ])('false and no throw when provenance is %s (wire shape)', (_label, json) => {
    const result = fromWire(json);
    expect(() => hasProvenance(result)).not.toThrow();
    expect(hasProvenance(result)).toBe(false);
  });

  it('true without validating entries (that is isProvenanceEntry’s job at the narrowing point)', () => {
    const result = fromWire(
      '{"files":{},"metadata":{},"provenance":{"files":{"a":{"entries":[{"kind":"bogus"}]}}}}'
    );
    expect(hasProvenance(result)).toBe(true);
  });

  it('requires files to be an OWN property (an inherited files does not count)', () => {
    const inherited = Object.create({ files: {} }) as object;
    const result: GenerationResult = { files: {}, metadata };
    Object.defineProperty(result, 'provenance', { value: inherited, enumerable: true });
    expect(hasProvenance(result)).toBe(false);
  });
});

describe('INV-18 — mergeProvenance: later wins wholesale per key; inputs untouched; fresh output', () => {
  const a: ProvenanceResult = {
    files: {
      'README.md': {
        entries: [
          { kind: 'file', paths: ['x'] },
          { kind: 'range', range: { start: 1, end: 1 }, paths: ['x'] },
        ],
      },
      'only-a.txt': { entries: [{ kind: 'file', paths: ['a'] }] },
    },
  };
  const b: ProvenanceResult = {
    files: {
      'README.md': { entries: [{ kind: 'file', paths: ['y'] }] },
      'only-b.txt': { entries: [{ kind: 'file', paths: ['b'] }] },
    },
  };

  it('key only in a is kept; key in both is b’s wholesale (=== b.files[k]); key order a then b’s new keys', () => {
    const merged = mergeProvenance(a, b);
    expect(Object.keys(merged.files)).toEqual(['README.md', 'only-a.txt', 'only-b.txt']);
    expect(merged.files['README.md']).toBe(b.files['README.md']);
    expect(merged.files['only-a.txt']).toBe(a.files['only-a.txt']);
    expect(merged.files['only-b.txt']).toBe(b.files['only-b.txt']);
  });

  it('neither input is mutated', () => {
    const snapA = structuredClone(a);
    const snapB = structuredClone(b);
    mergeProvenance(a, b);
    expect(a).toEqual(snapA);
    expect(b).toEqual(snapB);
  });

  it('mergeProvenance(a) !== a and deep-equals a', () => {
    const merged = mergeProvenance(a);
    expect(merged).not.toBe(a);
    expect(merged.files).not.toBe(a.files);
    expect(merged).toEqual(a);
  });

  it('mergeProvenance() → { files: {} }', () => {
    expect(mergeProvenance()).toEqual({ files: {} });
  });

  it('three-way merge applies later-wins left to right', () => {
    const c: ProvenanceResult = {
      files: { 'README.md': { entries: [{ kind: 'file', paths: ['z'] }] } },
    };
    const merged = mergeProvenance(a, b, c);
    expect(merged.files['README.md']).toBe(c.files['README.md']);
    expect(Object.keys(merged.files)).toEqual(['README.md', 'only-a.txt', 'only-b.txt']);
  });
});

describe('INV-22 — filterProvenanceByPath is bounded, by-identity, and never mutates', () => {
  const fileEntry: ProvenanceEntry = {
    kind: 'file',
    paths: ['token', 'token.name', 'modules[1].id'],
  };
  const rangeMatch: ProvenanceEntry = {
    kind: 'range',
    range: { start: 1, end: 2 },
    paths: ['token.name'],
  };
  const rangeMiss: ProvenanceEntry = {
    kind: 'range',
    range: { start: 3, end: 4 },
    paths: ['modules[1].id'],
  };
  const createdEmpty: ProvenanceEntry = { kind: 'created', paths: [] };
  const other: ProvenanceEntry = { kind: 'file', paths: ['unrelated'] };
  const result: ProvenanceResult = {
    files: {
      'a.txt': { entries: [fileEntry, createdEmpty, rangeMatch, rangeMiss] },
      'b.txt': { entries: [other] },
      'c.txt': { entries: [{ kind: 'file', paths: [] }] },
    },
  };

  it('omits non-matching files and drops non-matching entries of a matching file', () => {
    const filtered = filterProvenanceByPath(result, 'token.name');
    expect(Object.keys(filtered.files)).toEqual(['a.txt']);
    expect(filtered.files['a.txt']?.entries).toEqual([fileEntry, rangeMatch]);
  });

  it('returns matching entries BY IDENTITY, in input order', () => {
    const filtered = filterProvenanceByPath(result, 'token');
    const entries = filtered.files['a.txt']?.entries ?? [];
    expect(entries[0]).toBe(fileEntry);
    expect(entries[1]).toBe(rangeMatch);
    expect(entries).toHaveLength(2);
  });

  it('a child query matches a parent read and an index query matches only that index', () => {
    expect(filterProvenanceByPath(result, 'token.symbol').files['a.txt']?.entries).toEqual([
      fileEntry,
    ]);
    expect(filterProvenanceByPath(result, 'modules[1]').files['a.txt']?.entries).toEqual([
      fileEntry,
      rangeMiss,
    ]);
    expect(filterProvenanceByPath(result, 'modules[10]').files).toEqual({});
    expect(filterProvenanceByPath(result, 'modules[0]').files).toEqual({});
  });

  it("empty-paths entries never match, even for the root query ''", () => {
    const filtered = filterProvenanceByPath(result, '');
    expect(Object.keys(filtered.files)).toEqual(['a.txt', 'b.txt']);
    expect(filtered.files['a.txt']?.entries).toEqual([fileEntry, rangeMatch, rangeMiss]);
    expect(filtered.files['a.txt']?.entries).not.toContain(createdEmpty);
    expect(filtered.files['c.txt']).toBeUndefined();
  });

  it('a recorded root path matches every query', () => {
    const rooted: ProvenanceResult = { files: { r: { entries: [{ kind: 'file', paths: [''] }] } } };
    expect(Object.keys(filterProvenanceByPath(rooted, 'anything.deep[3]').files)).toEqual(['r']);
  });

  it('the input is deep-equal before and after; the output is a fresh object', () => {
    const snapshot = structuredClone(result);
    const filtered = filterProvenanceByPath(result, 'token');
    expect(result).toEqual(snapshot);
    expect(filtered).not.toBe(result);
    expect(filtered.files).not.toBe(result.files);
    expect(filtered.files['a.txt']).not.toBe(result.files['a.txt']);
  });

  it('a malformed query throws RangeError instead of returning an empty result', () => {
    expect(() => filterProvenanceByPath(result, 'token..name')).toThrowError(RangeError);
    expect(() => filterProvenanceByPath(result, '[0]')).toThrowError(RangeError);
  });

  it('a malformed RECORDED path throws RangeError too (a lying path is a bug, not "nothing depends on this")', () => {
    const bad: ProvenanceResult = {
      files: { f: { entries: [{ kind: 'file', paths: ['a..b'] }] } },
    };
    expect(() => filterProvenanceByPath(bad, 'a')).toThrowError(RangeError);
  });

  it('no match at all → { files: {} }', () => {
    expect(filterProvenanceByPath(result, 'nowhere')).toEqual({ files: {} });
  });
});
